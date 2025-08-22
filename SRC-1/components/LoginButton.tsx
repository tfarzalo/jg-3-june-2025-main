import { useAuth0 } from '@auth0/auth0-react';

export const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();
  
  return (
    <button
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      onClick={() => loginWithRedirect()}
    >
      Log In
    </button>
  );
};