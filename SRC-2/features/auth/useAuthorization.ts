import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

export const useAuthorization = () => {
  const { user, getAccessTokenSilently } = useAuth0();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUserRoles = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            scope: 'read:roles',
          },
        });
        
        // Auth0 includes roles in the user object under user['https://your-namespace/roles']
        const namespace = 'https://api.paintingbusiness.com';
        const roles = user?.[`${namespace}/roles`] || [];
        
        setUserRoles(Array.isArray(roles) ? roles : []);
      } catch (error) {
        console.error('Error getting user roles', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      getUserRoles();
    } else {
      setIsLoading(false);
    }
  }, [getAccessTokenSilently, user]);

  const hasRole = (role: string) => userRoles.includes(role);
  
  const isSuperAdmin = () => hasRole('Super Admin');
  const isJGAdmin = () => hasRole('JG Management Admin');
  const isSubcontractor = () => hasRole('Subcontractor');

  return {
    userRoles,
    hasRole,
    isSuperAdmin,
    isJGAdmin,
    isSubcontractor,
    isLoading,
  };
};