import { useAuth0 } from '@auth0/auth0-react';

export const LogoutButton = () => {
  const { logout } = useAuth0();
  
  return (
    <button
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
      onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
    >
      Log Out
    </button>
  );
};