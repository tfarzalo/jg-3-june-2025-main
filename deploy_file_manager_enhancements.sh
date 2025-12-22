#!/bin/bash

# Deployment Script for File Manager Enhancements
# This script helps deploy the rename_folder function to the database

echo "========================================="
echo "File Manager Enhancement Deployment"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20250120000020_add_rename_folder_function.sql" ]; then
    echo -e "${RED}Error: Migration file not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo "Migration file found: ✓"
echo ""

# Ask user for deployment method
echo "How would you like to deploy?"
echo "1) Using Supabase CLI (recommended)"
echo "2) Copy SQL to clipboard (manual deployment)"
echo "3) Show SQL content"
echo "4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Checking for Supabase CLI..."
        if ! command -v supabase &> /dev/null; then
            echo -e "${RED}Supabase CLI not found!${NC}"
            echo "Install it with: npm install -g supabase"
            echo "Or use option 2 to deploy manually."
            exit 1
        fi
        
        echo "Supabase CLI found: ✓"
        echo ""
        echo -e "${YELLOW}About to run: supabase db push${NC}"
        echo "This will apply all pending migrations to your linked database."
        echo ""
        read -p "Continue? (y/n): " confirm
        
        if [ "$confirm" == "y" ] || [ "$confirm" == "Y" ]; then
            echo ""
            echo "Deploying migration..."
            supabase db push
            
            if [ $? -eq 0 ]; then
                echo ""
                echo -e "${GREEN}✓ Migration deployed successfully!${NC}"
                echo ""
                echo "Next steps:"
                echo "1. Test the rename functionality in File Manager"
                echo "2. Try renaming a folder"
                echo "3. Verify files still display correctly"
                echo "4. Test in Spanish mode with ?lang=es"
            else
                echo ""
                echo -e "${RED}✗ Migration failed!${NC}"
                echo "Check the error message above and try again."
                exit 1
            fi
        else
            echo "Deployment cancelled."
        fi
        ;;
        
    2)
        echo ""
        echo "Copying SQL to clipboard..."
        
        if command -v pbcopy &> /dev/null; then
            # macOS
            cat supabase/migrations/20250120000020_add_rename_folder_function.sql | pbcopy
            echo -e "${GREEN}✓ SQL copied to clipboard!${NC}"
        elif command -v xclip &> /dev/null; then
            # Linux with xclip
            cat supabase/migrations/20250120000020_add_rename_folder_function.sql | xclip -selection clipboard
            echo -e "${GREEN}✓ SQL copied to clipboard!${NC}"
        else
            echo -e "${YELLOW}Could not copy to clipboard automatically.${NC}"
            echo "The SQL file is located at:"
            echo "supabase/migrations/20250120000020_add_rename_folder_function.sql"
        fi
        
        echo ""
        echo "Manual deployment steps:"
        echo "1. Open your Supabase SQL Editor"
        echo "2. Paste the SQL (already in clipboard)"
        echo "3. Run the query"
        echo "4. Verify the function was created"
        ;;
        
    3)
        echo ""
        echo "========================================="
        echo "SQL Migration Content"
        echo "========================================="
        echo ""
        cat supabase/migrations/20250120000020_add_rename_folder_function.sql
        echo ""
        echo "========================================="
        ;;
        
    4)
        echo "Exiting..."
        exit 0
        ;;
        
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac

echo ""
echo "========================================="
echo "Deployment Complete"
echo "========================================="
echo ""
echo "Documentation files:"
echo "  - FILE_MANAGER_QUICK_START_GUIDE.md"
echo "  - FILE_MANAGER_TESTING_CHECKLIST.md"
echo "  - COMPLETE_FILE_MANAGER_IMPLEMENTATION_SUMMARY.md"
echo ""
echo "Happy renaming! 📝"
