import { Auth0Provider } from '@auth0/auth0-react';
import React from 'react';

interface Auth0ProviderWithHistoryProps {
  children: React.ReactNode;
}

export const Auth0ProviderWithHistory = ({ children }: Auth0ProviderWithHistoryProps) => {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
        scope: 'openid profile email'
      }}
    >
      {children}
    </Auth0Provider>
  );
};