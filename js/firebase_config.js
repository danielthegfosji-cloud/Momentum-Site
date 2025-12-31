// TODO: Replace with your app's Firebase project configuration
const firebaseConfig = {

  apiKey: "AIzaSyDWYj9FBZvAa77VXZWTmFA0Zu3RF1SHfrA",

  authDomain: "momentum-c3b78.firebaseapp.com",

  projectId: "momentum-c3b78",

  storageBucket: "momentum-c3b78.firebasestorage.app",

  messagingSenderId: "632026273712",

  appId: "1:632026273712:web:283484eaafa039a5482875"

};


// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db_firestore = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Add the Drive scope to the provider so we can request it during sign-in
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');