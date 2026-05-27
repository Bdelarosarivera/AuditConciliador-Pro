import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "Admin" | "Auditor" | "Supervisor" | "Viewer";
  createdAt: string;
  lastLogin: string;
  status: "active" | "suspended";
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, preferredRole?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserRole: (targetUid: string, role: "Admin" | "Auditor" | "Supervisor" | "Viewer") => Promise<void>;
  updateUserStatus: (targetUid: string, status: "active" | "suspended") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe ser utilizado dentro de un AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync user changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // Attempt to fetch profile
          const userDocRef = doc(db, "users", user.uid);
          let userSnap = await getDoc(userDocRef);

          if (!userSnap.exists()) {
            // First time login - Bootstrap profile creation
            const timestamp = new Date().toISOString();
            
            // Auto bootstrap the project owner bartolodelarosarivera@gmail.com as Admin
            const isOwnerAdmin = user.email?.toLowerCase() === "bartolodelarosarivera@gmail.com";
            const defaultRole = isOwnerAdmin ? "Admin" : "Auditor";

            const newProfile: UserProfile = {
              uid: user.uid,
              name: user.displayName || user.email?.split("@")[0] || "Usuario Registrado",
              email: user.email || "",
              role: defaultRole,
              createdAt: timestamp,
              lastLogin: timestamp,
              status: "active",
            };

            // Save to Firestore with proper error wrap
            try {
              await setDoc(userDocRef, {
                ...newProfile,
                createdAt: timestamp,
                lastLogin: timestamp,
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
            }
            setUserProfile(newProfile);
          } else {
            // Update lastLogin
            const existingProfile = userSnap.data() as UserProfile;
            const updatedProfile = {
              ...existingProfile,
              lastLogin: new Date().toISOString(),
            };
            
            try {
              await updateDoc(userDocRef, {
                lastLogin: updatedProfile.lastLogin
              });
            } catch (err) {
              console.warn("Could not update last login timestamp in Firestore", err);
            }
            setUserProfile(updatedProfile);
          }
        } catch (error) {
          console.error("Error cargando perfil de usuario de Firestore:", error);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Google Provider SignIn
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  // Log in with Email & Contraseña
  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  // Sign up with Email, name and custom preferred Role (Viewer / Auditor etc)
  const registerWithEmail = async (email: string, pass: string, name: string, preferredRole: any = "Auditor") => {
    const credential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = credential.user;
    
    await updateProfile(user, { displayName: name });

    const userDocRef = doc(db, "users", user.uid);
    const timestamp = new Date().toISOString();
    
    const isOwnerAdmin = email.toLowerCase() === "bartolodelarosarivera@gmail.com";
    const finalRole = isOwnerAdmin ? "Admin" : preferredRole;

    const newProfile: UserProfile = {
      uid: user.uid,
      name,
      email,
      role: finalRole,
      createdAt: timestamp,
      lastLogin: timestamp,
      status: "active",
    };

    try {
      await setDoc(userDocRef, newProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
    }

    setUserProfile(newProfile);
  };

  // Password recovery
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Log Out
  const logout = async () => {
    await signOut(auth);
  };

  // Admin exclusive user roles toggles
  const updateUserRole = async (targetUid: string, role: "Admin" | "Auditor" | "Supervisor" | "Viewer") => {
    if (userProfile?.role !== "Admin") {
      throw new Error("Acceso denegado: Se requiere privilegios de Administrador para reasignar roles.");
    }
    const userDocRef = doc(db, "users", targetUid);
    try {
      await updateDoc(userDocRef, { role });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  // Admin exclusive user status toggles (suspensions)
  const updateUserStatus = async (targetUid: string, status: "active" | "suspended") => {
    if (userProfile?.role !== "Admin") {
      throw new Error("Acceso denegado: Se requiere privilegios de Administrador para suspender usuarios.");
    }
    const userDocRef = doc(db, "users", targetUid);
    try {
      await updateDoc(userDocRef, { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        updateUserRole,
        updateUserStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
