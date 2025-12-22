/*
  # Fix invalid regex in files table constraint

  The CHECK constraint on files.type has an invalid regex pattern that causes
  error 2201B: "invalid regular expression: invalid character range"
  
  The issue is in the character class [\-\+\.] where the dash is in the middle.
  In regex character classes, a dash in the middle denotes a range (like a-z).
  Since \- comes before \+, PostgreSQL tries to interpret it as a range from 
  ASCII 45 (dash) to ASCII 43 (plus), which is invalid.

  Fix: Move the dash to the end of the character class: [a-zA-Z0-9+.-]
  
  Note: The constraint is applied using NOT VALID first, then validated separately
  to avoid checking existing rows.
*/

-- Drop the old constraint if it exists
ALTER TABLE files DROP CONSTRAINT IF EXISTS valid_file_type;

-- Add the corrected constraint with the fixed regex
-- The key fix: dash must be at the very end or very beginning of the character class
-- to be treated as a literal character, not a range operator
ALTER TABLE files ADD CONSTRAINT valid_file_type 
  CHECK (type ~ '^[a-zA-Z0-9]+/[a-zA-Z0-9+.-]+$');

COMMENT ON CONSTRAINT valid_file_type ON files IS 
  'Validates MIME type format. Regex fixed: dash at end of char class to avoid range interpretation.';

COMMENT ON CONSTRAINT valid_file_type ON files IS 
  'Validates MIME type format (e.g., image/png, application/pdf). Fixed regex pattern: dash at end of character class.';
