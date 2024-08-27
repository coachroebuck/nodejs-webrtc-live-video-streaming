const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;
let remoteStream;
let peerConnection;
let isCallActive = false;
let iceCandidateQueue = [];  // Queue for storing ICE candidates until the remote description is set

const socket = io();
const room = "testing"; //prompt("Enter room name:");  // Prompt user to enter a room name
if (room) {
  socket.emit('join-room', room);
}

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Get local media stream
function getLocalStream() {
  return navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        console.log("received local stream...")
      localStream = stream;
      localVideo.srcObject = stream;
    })
    .catch(error => {
      console.error('Error accessing media devices:', error);
    });
}

// Start Call Button
document.getElementById('startCall').addEventListener('click', () => {
  if (!isCallActive) {
    startCall();
  } else {
    alert('Call already in progress.');
  }
});

function startCall() {
  console.log("Starting call on Device B...");
  if (peerConnection) {
    console.log("Closing existing peer connection...");
    peerConnection.close();  // Close previous peer connection
  }
  createPeerConnection();  // Create a new peer connection

  getLocalStream().then(() => {
    console.log("Adding local stream to peer connection on Device B...");
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Create an offer
    peerConnection.createOffer()
      .then(offer => {
        console.log("Setting local description for offer on Device B...");
        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        console.log("Sending offer to server from Device B...");
        socket.emit('offer', peerConnection.localDescription, room);
        isCallActive = true;
      })
      .catch(error => console.error('Error during offer creation on Device B:', error));
  });
}

// End Call Button
document.getElementById('endCall').addEventListener('click', () => {
  endCall();
});

function endCall() {
  if (peerConnection) {
    console.log('Ending call...');
    peerConnection.close();
    peerConnection = null;

    // Clear video elements
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;

    // Stop all tracks in local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;  // Reset localStream to null
    }

    // Reset the ICE candidate queue and other state
    iceCandidateQueue = [];
    remoteStream = null;  // Reset the remote stream

    isCallActive = false;
    socket.emit('end-call', room);  // Notify the server that the call ended
    console.log("call ended...");
  }
}


function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    console.log("received remote track...")
    if (!remoteStream) {
      remoteStream = new MediaStream();
      remoteVideo.srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    console.log("received ice candidate...")
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate, room);
    }
  };
}

// Handle incoming offer
socket.on('offer', (offer) => {
  console.log('Offer received:', offer);
  createPeerConnection();  // Create peer connection

  peerConnection.setRemoteDescription(offer)
    .then(() => {
      processIceCandidates();
      return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    })
    .then(stream => {
      console.log("Local stream received for answer...");
      localStream = stream;
      localVideo.srcObject = stream;
      localStream.getTracks().forEach(track => {
        console.log("Adding local stream to peer connection...");
        peerConnection.addTrack(track, localStream);
      });
      return peerConnection.createAnswer();
    })
    .then(answer => {
      console.log("Answer created and sending to server...");
      return peerConnection.setLocalDescription(answer);
    })
    .then(() => {
      socket.emit('answer', peerConnection.localDescription, room);
      console.log("Answer sent to server.");
      isCallActive = true;
    })
    .catch(error => console.error('Error during answer creation:', error));
});

// Handle incoming answer
socket.on('answer', (answer) => {
  peerConnection.setRemoteDescription(answer)
    .then(() => {
        processIceCandidates();
      console.log('Answer received and remote description set.');
    })
    .catch(error => console.error('Error setting remote description:', error));
});

// Handle ICE candidates
socket.on('ice-candidate', (candidate) => {
  const iceCandidate = new RTCIceCandidate(candidate);

  if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
    console.log("adding ICE candidate...")
    peerConnection.addIceCandidate(iceCandidate)
      .catch(error => console.error('Error adding ICE candidate:', error));
  } else {
    // Queue ICE candidate until remote description is set
    console.log("queue ICE candidate until remote description has been set...")
    iceCandidateQueue.push(iceCandidate);
  }
});

// Process the ICE candidate queue after setting the remote description
function processIceCandidates() {
  iceCandidateQueue.forEach(candidate => {
    peerConnection.addIceCandidate(candidate)
      .catch(error => console.error('Error adding ICE candidate:', error));
  });
  iceCandidateQueue = [];  // Clear the queue after processing
}

socket.on('call-ended', () => {
  console.log('Call was ended by the other party.');
  // Handle UI updates, cleanup, or any other necessary actions
  remoteVideo.srcObject = null;
});
