const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;
let remoteStream;
let peerConnection;

const socket = io();

// STUN servers for WebRTC connection (required for most setups)
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Get local media stream
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
  })
  .catch(error => {
    console.error('Error accessing media devices.', error);
  });

// Start the call on button click
document.getElementById('startCall').addEventListener('click', () => {
  startCall();
});

function startCall() {
  // Create a new RTCPeerConnection
  peerConnection = new RTCPeerConnection(configuration);

  // Add local stream to peer connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
      document.getElementById('remoteVideo').srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  };

  // Create an offer
  peerConnection.createOffer()
    .then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit('offer', offer);
    });
}

// Handle incoming offer
socket.on('offer', (offer) => {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.ontrack = (event) => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
      document.getElementById('remoteVideo').srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  };

  peerConnection.setRemoteDescription(offer);
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.createAnswer()
    .then(answer => {
      peerConnection.setLocalDescription(answer);
      socket.emit('answer', answer);
    });
});

// Handle incoming answer
socket.on('answer', (answer) => {
  peerConnection.setRemoteDescription(answer);
});

// Handle incoming ICE candidates
socket.on('ice-candidate', (candidate) => {
  const iceCandidate = new RTCIceCandidate(candidate);
  peerConnection.addIceCandidate(iceCandidate);
});
