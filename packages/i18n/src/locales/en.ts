export const en = {
  home: {
    title: "App Start",
    blurb: "Vite + React starter with shared UI, i18n, and cookie-based auth client.",
  },
  auth: {
    signInTitle: "Sign in",
    signUpTitle: "Create account",
    emailLabel: "Email",
    passwordLabel: "Password",
    signInCta: "Sign in",
    signUpCta: "Sign up",
    signOutCta: "Sign out",
    noAccount: "Need an account?",
    hasAccount: "Already have an account?",
    goToSignUp: "Sign up",
    goToSignIn: "Sign in",
  },
  errors: {
    auth: {
      invalidCredentials: "Invalid email or password.",
      emailTaken: "An account with this email already exists.",
      unauthorized: "You need to sign in to continue.",
      forbidden: "You do not have permission to do that.",
      noUser: "No user found for this email.",
    },
    validation: {
      failed: "Please check the form and try again.",
    },
    idempotency: {
      conflict: "This request was already processed.",
    },
    common: {
      internal: "Something went wrong. Please try again.",
    },
  },
} as const;

export type AppLocaleResources = typeof en;
