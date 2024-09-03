const localVideo = document.getElementById('localVideo');
const primaryRemoteVideo = document.getElementById('primaryRemoteVideo');
const localScreen = document.getElementById('localScreen');
const remoteScreen = document.getElementById('remoteScreen');
const videoContainer = document.getElementById("videoContainer");
let localStream;
let remoteStream;
let peerConnection;
let isCallActive = false;
let iceCandidateQueue = [];  // Queue for storing ICE candidates until the remote description is set
let peerConnections = {};
let iceCandidateQueues = {};

const socket = io();
const room = "testing"; //prompt("Enter room name:");  // Prompt user to enter a room name
if (room) {
  socket.emit('join-room', room);
}

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

createHtmlEventListeners();
createSocketEventListeners();

function createHtmlEventListeners() {
    // Start Call Button
    document.getElementById('startCall').addEventListener('click', () => {
      onStartCall();
    });

    document.getElementById('shareScreen').addEventListener('click', () => {
        onShareScreen();
    });

    // End Call Button
    document.getElementById('endCall').addEventListener('click', () => {
      endCall();
    });
}

function createSocketEventListeners() {
    // Handle incoming offer
    socket.on('offer', (offer, socketId) => {
        onOfferReceived(offer, socketId);
    });

    socket.on('ready-to-call', (socketId) => {
        onReadyToCall(socketId);
    });

    // Handle incoming answer
    socket.on('answer', (answer, socketId) => {
        onAnswerReceived(answer, socketId);
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (candidate, socketId) => {
        onIceCandidate(candidate, socketId);
    });

    socket.on('call-ended', (socketId) => {
        onCallEnded(socketId);
    });
}

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

function onStartCall() {
    if (!isCallActive) {
        startCall();
    } else {
        alert('Call already in progress.');
    }
}

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

function onShareScreen() {
    if (!peerConnection) {
        alert("You must be in a call to share your screen!");
        return;
    }

    navigator.mediaDevices.getDisplayMedia({ video: true })
    .then(screenStream => {
        console.log("Screen sharing started...");
        localScreen.srcObject = screenStream;

        // Replace the video track with the screen-sharing track
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        sender.replaceTrack(screenTrack);

        // Listen for the end of screen sharing
        screenTrack.onended = () => {
            console.log("Screen sharing ended, reverting to camera...");
            localScreen.srcObject = null; // Clear the local screen element
            // Revert to camera when screen sharing ends
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStream = stream;
                localVideo.srcObject = stream;
                const videoTrack = localStream.getVideoTracks()[0];
                sender.replaceTrack(videoTrack);
            });
        };
    })
    .catch(error => {
        console.error('Error accessing display media.', error);
    });
}

function endCall() {
  if (peerConnection) {
    console.log('Ending call...');
    peerConnection.close();
    peerConnection = null;

    // Clear video elements
    localVideo.srcObject = null;
    primaryRemoteVideo.srcObject = null;
    localScreen.srcObject = null;
    remoteScreen.srcObject = null;

    // Stop all tracks in local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;  // Reset localStream to null
    }

    if (localScreen.srcObject) {
      localScreen.srcObject.getTracks().forEach(track => track.stop());
      localScreen.srcObject = null;
    }

    // Reset the ICE candidate queue and other state
    iceCandidateQueue = [];
    remoteStream = null;  // Reset the remote stream

    isCallActive = false;
    socket.emit('end-call', room);  // Notify the server that the call ended
    console.log("call ended...");
  }
}

function createPeerConnection(socketId) {
  peerConnection = new RTCPeerConnection(configuration);

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    console.log("Received remote track...");

    if (event.track.kind === 'video') {
      // Check if the track is part of a screen share or camera
      if (event.track.label.includes("screen")) {
        if (!remoteScreen.srcObject) {
          remoteScreen.srcObject = new MediaStream();
        }
        remoteScreen.srcObject.addTrack(event.track);
        console.log("Screen sharing track received...");
      } else {
        if (!remoteStream) {
          remoteStream = new MediaStream();
          primaryRemoteVideo.srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
        console.log("Camera video track received...");
      }
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    console.log("Received ICE candidate...");
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate, room);
    }
  };
}

// Process the ICE candidate queue after setting the remote description
function processIceCandidates() {
  iceCandidateQueue.forEach(candidate => {
    peerConnection.addIceCandidate(candidate)
      .catch(error => console.error('Error adding ICE candidate:', error));
  });
  iceCandidateQueue = [];  // Clear the queue after processing
}

function onOfferReceived(offer) {
function onReadyToCall(socketId) {
}

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
}

function onAnswerReceived(answer) {
    peerConnection.setRemoteDescription(answer)
    .then(() => {
        processIceCandidates();
        console.log('Answer received and remote description set.');
    })
    .catch(error => console.error('Error setting remote description:', error));
}

function onIceCandidate(candidate) {
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
}

function onCallEnded() {
    console.log('Call was ended by the other party.');
    // Handle UI updates, cleanup, or any other necessary actions
    primaryRemoteVideo.srcObject = null;
    remoteStream = null;  // Reset the remote stream
}