import { api } from './api';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';

export const useUserSync = () => {
  const { user, isAuthenticated } = useAuth0();
  
  useEffect(() => {
    const syncUserToDatabase = async () => {
      if (isAuthenticated && user) {
        try {
          // Check if user exists in database
          const response = await api.getUserByEmail(user.email);
          
          if (response.data.length === 0) {
            // User doesn't exist, create new user
            const userData = {
              email: user.email,
              name: user.name,
              auth0_id: user.sub,
              // Add other user fields as needed
            };
            
            await api.createUser(userData);
          }
        } catch (error) {
          console.error('Error syncing user to database', error);
        }
      }
    };
    
    syncUserToDatabase();
  }, [isAuthenticated, user]);
};