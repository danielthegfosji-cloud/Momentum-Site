// NOTE: This file has been repurposed to handle Firebase Authentication only.
// All Google Drive-specific API (gapi) code has been removed.

// --- Global State ---
let currentUser = null;

/**
 * Listens for Firebase authentication state changes and updates the UI.
 * This is the central point for auth state management.
 */
function initializeAuth() {
    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateSigninStatus(!!user);

        // Fire a custom event to notify other modules of the auth state change.
        // This allows other parts of the app (like a future Firebase sync module) to react.
        document.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user } }));
    });
}

/**
 * Updates the Sign In/Out button text based on the current auth state.
 * @param {boolean} isSignedIn
 */
function updateSigninStatus(isSignedIn) {
    const authButton = document.getElementById('google-auth-btn');
    if (!authButton) return;

    const buttonTextSpan = authButton.querySelector('.google-btn-text');
    const buttonIconSvg = authButton.querySelector('.google-icon');

    if (buttonTextSpan && buttonIconSvg) {
        if (isSignedIn && auth.currentUser) {
            buttonIconSvg.style.display = 'none'; // Hide the Google logo when signed in
            const firstName = auth.currentUser.displayName ? auth.currentUser.displayName.split(' ')[0] : 'User';
            buttonTextSpan.textContent = `Sign Out (${firstName})`;
        } else {
            buttonIconSvg.style.display = 'block'; // Show the Google logo when signed out
            buttonTextSpan.textContent = 'Sign In with Google';
        }
    }
}

/**
 * Handles the authentication flow using Firebase.
 * Signs in with Google via a popup or signs the current user out.
 */
function handleAuthClick() {
    if (!auth.currentUser) {
        // User is not signed in, so start the sign-in process.
        // The `googleProvider` is configured in firebase_config.js to request necessary scopes.
        auth.signInWithPopup(googleProvider)
            .then((result) => {
                console.log("Signed in as:", result.user.displayName);
                // The onAuthStateChanged listener will handle the UI update automatically.
            }).catch((error) => {
                if (error.code === 'auth/popup-closed-by-user') {
                    alert('The sign-in window was closed before completing. If you are on a new domain (like GitHub Pages), make sure it has been added as an "Authorized Domain" in your Firebase Authentication settings.');
                } else {
                    alert(`Google sign-in error: ${error.message}`);
                }
                console.error("Firebase Auth Error:", error.code, error.message);
            });
    } else {
        // User is signed in, so sign them out.
        auth.signOut().then(() => {
            console.log("User signed out.");
            // The onAuthStateChanged listener will handle the UI update automatically.
        }).catch((error) => {
            console.error("Firebase Sign Out Error:", error);
        });
    }
}

// Initialize the auth listener when this script is loaded.
// Note: `auth` is available because `firebase_config.js` is loaded before this script.
initializeAuth();