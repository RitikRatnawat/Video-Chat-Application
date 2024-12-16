let APP_ID = "9d34efb605f047bb98fce6af4c98ae4d"

let token = null;
let uid = String(Math.floor(Math.random() * 10000))

// Declaration of Variables
let client;
let channel;

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId){
    window.location = "lobby.html"
}

let localStream;
let remoteStream;
let peerConnection;

// Added Stun Servers
const servers = {
    iceServers: [
        {
            urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
        }
    ]
}

// Creating Constraints for Video and Audio input
let constraints ={
    video: {
        width: {min:640, ideal:1920, max:1920},
        height: {min:480, ideal:1080, max:1080}
    },

    audio: true
}


// Initialization of Peer Chat
let init = async () => {
    // Creating AgoraRTM instance for Signaling Server
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})

    // Creating a Channel for Communication
    channel = client.createChannel(roomId)
    await channel.join()

    // Event Handling when a new member joined the Chat
    channel.on('MemberJoined', handleMemberJoined)

    // Event Handling when a member left the chat
    channel.on('MemberLeft', handleMemberLeft)

    // Event Handling when a msg is received from the Peer
    client.on('MessageFromPeer', handleMessageFromPeer)

    // Getting the Video feed from the Local system
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById("user1").srcObject = localStream
}

// Function to create a new Peer Connection
let createPeerConnection = async (MemberID) => {

    peerConnection = new RTCPeerConnection(servers)

    // Creating a remoteStream as a MediaStream for remote chat feed
    remoteStream = new MediaStream()

    // Adding Styles on Peer Connection
    document.getElementById("user2").srcObject = remoteStream
    document.getElementById("user2").style.display = "block"

    document.getElementById("user1").classList.add("small-frame")

    // Check if localStream is not exists then request for it
    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia(constraints)
        document.getElementById("user1").srcObject = localStream
    }

    // Adding Tracks for Local Stream
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    // Event Handling on Receiving Tracks from Remote Stream
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    // Event Handling on Receiving ICE Candidates
    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            client.sendMessageToPeer({text: JSON.stringify({'type': 'candidate', 'candidate': event.candidate})}, MemberID)
        }
    }
}

// Function to create a SDP Offer
let createOffer = async (MemberID) => {
    
    // Creating a Peer Connection
    await createPeerConnection(MemberID)

    // Creating an SDP Offer
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    // Sending SDP offer to another peer
    client.sendMessageToPeer({text: JSON.stringify({'type': 'offer', 'offer': offer})}, MemberID)
}

// Function to create a SDP Answer
let createAnswer = async (MemberID, offer) => {

    // Creating a Peer Connection
    await createPeerConnection(MemberID)

    // Setting up SDP offer as remote Description
    await peerConnection.setRemoteDescription(offer)

    // Creating an SDP answer
    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    // Sending SDP answer to another peer
    client.sendMessageToPeer({text: JSON.stringify({'type': 'answer', 'answer': answer})}, MemberID)
}

// Function to Add SDP answer as remote description
let addAnswer = async (answer) => {

    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer)
    }
}

// Function for handling MemberJoined Event
let handleMemberJoined = async (MemberID) => {
    console.log("New Member Joined :", MemberID)
    createOffer(MemberID)
}

// Function for handling MessageFromPeer Event
let handleMessageFromPeer = async (message, MemberID) => {
    msg = JSON.parse(message.text)

    if(msg.type === 'offer'){
        createAnswer(MemberID, msg.offer)
    }
    else if(msg.type === "answer"){
        addAnswer(msg.answer)
    }
    else if(msg.type === "candidate" && peerConnection){
        peerConnection.addIceCandidate(msg.candidate)
    }
}

// Function for handling MemberLeft Event
let handleMemberLeft = (MemberID) => {
    document.getElementById("user2").style.display = "none"
    document.getElementById("user1").classList.remove("small-frame")
}

// Function to leave the channel and logout the client
let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

// Function to toggle Camera On/Off
let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find((track) => track.kind === "video")

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById("camera-btn").style.backgroundColor = 'rgb(255, 80, 80)'
    }
    else{
        videoTrack.enabled = true
        document.getElementById("camera-btn").style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

// Function to toggle Mic On/Off
let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find((track) => track.kind === "audio")

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById("mic-btn").style.backgroundColor = 'rgb(255, 80, 80)'
    }
    else{
        audioTrack.enabled = true
        document.getElementById("mic-btn").style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

// Event handling for action to be performed before closing the browser tab
window.addEventListener('beforeunload', leaveChannel)

// Event handling for Controls in the Chat
document.getElementById("camera-btn").addEventListener("click", toggleCamera)
document.getElementById("mic-btn").addEventListener("click", toggleMic)

init()