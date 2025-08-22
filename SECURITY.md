# Security Guidelines

## Environment Variables

This project uses environment variables to store sensitive configuration. Follow these guidelines:

### Setup Instructions

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Replace placeholder values in `.env` with your actual Supabase credentials:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous public key
   - `VITE_SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (admin privileges)
   - `VITE_SUPABASE_JWT_SECRET`: Your Supabase JWT signing secret

### Important Security Notes

- **Never commit real credentials to version control**
- The `.env` file should contain placeholder values only
- Your actual `.env` file should be listed in `.gitignore`
- Service role keys have admin privileges - handle with care

## Database Migration Security

The SQL migration files in `tools/.bolt/supabase_discarded_migrations/` contain admin user creation scripts.

### Before Running Migrations

1. Update the admin credentials in the SQL files:
   - Replace `YOUR_ADMIN_EMAIL@example.com` with your actual admin email
   - Replace `YOUR_SECURE_PASSWORD_HERE` with a strong password

2. Use a strong password that includes:
   - At least 12 characters
   - Uppercase and lowercase letters
   - Numbers and special characters
   - No common dictionary words

### After Setup

- Change default passwords immediately after first login
- Enable two-factor authentication if available
- Regularly rotate admin passwords
- Monitor admin user access logs

## Best Practices

1. **Environment Variables**: Use environment variables for all sensitive configuration
2. **Secrets Management**: Consider using a dedicated secrets management service for production
3. **Access Control**: Implement role-based access control (RBAC) for database operations
4. **Monitoring**: Set up logging and monitoring for admin actions
5. **Updates**: Keep dependencies updated and monitor for security vulnerabilities

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
- Do not create public GitHub issues for security vulnerabilities
- Contact the project maintainers directly
- Provide detailed information about the vulnerability
- Allow time for the issue to be addressed before public disclosure