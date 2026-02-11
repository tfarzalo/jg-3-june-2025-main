-- =====================================================
-- Trigger Test Script
-- Tests that the trigger logic works correctly
-- =====================================================

-- Note: Replace 'YOUR_PROPERTY_ID' with an actual property ID from your database
-- You can find one by running: SELECT id FROM properties LIMIT 1;

-- Setup: Create test contacts for a property
DO $$
DECLARE
    v_property_id uuid;
    v_contact1_id uuid;
    v_contact2_id uuid;
    v_contact3_id uuid;
BEGIN
    -- Get a test property (or create one)
    SELECT id INTO v_property_id FROM properties LIMIT 1;
    
    IF v_property_id IS NULL THEN
        RAISE NOTICE 'No properties found. Please run this script after you have at least one property.';
        RETURN;
    END IF;

    RAISE NOTICE 'Using property ID: %', v_property_id;

    -- Clean up any existing test contacts
    DELETE FROM property_contacts 
    WHERE property_id = v_property_id 
      AND name LIKE 'TEST CONTACT%';

    -- Test 1: Create contact with subcontractor role
    INSERT INTO property_contacts (
        property_id, 
        name, 
        email, 
        position,
        is_subcontractor_contact
    ) VALUES (
        v_property_id,
        'TEST CONTACT 1',
        'test1@example.com',
        'Test Position 1',
        true
    ) RETURNING id INTO v_contact1_id;

    RAISE NOTICE 'Test 1: Created contact 1 as subcontractor';

    -- Test 2: Create another contact and try to make it subcontractor too
    INSERT INTO property_contacts (
        property_id,
        name,
        email,
        position,
        is_subcontractor_contact
    ) VALUES (
        v_property_id,
        'TEST CONTACT 2',
        'test2@example.com',
        'Test Position 2',
        true
    ) RETURNING id INTO v_contact2_id;

    RAISE NOTICE 'Test 2: Created contact 2 as subcontractor';

    -- Verify only contact 2 is subcontractor (should have unseated contact 1)
    IF (SELECT is_subcontractor_contact FROM property_contacts WHERE id = v_contact1_id) = false AND
       (SELECT is_subcontractor_contact FROM property_contacts WHERE id = v_contact2_id) = true THEN
        RAISE NOTICE '✅ Test 2 PASSED: Only one subcontractor contact allowed';
    ELSE
        RAISE WARNING '❌ Test 2 FAILED: Multiple subcontractor contacts found';
    END IF;

    -- Test 3: Set contact as primary approval recipient
    UPDATE property_contacts 
    SET is_primary_approval_recipient = true
    WHERE id = v_contact1_id;

    -- Verify is_approval_recipient was auto-set
    IF (SELECT is_approval_recipient FROM property_contacts WHERE id = v_contact1_id) = true THEN
        RAISE NOTICE '✅ Test 3 PASSED: Setting primary approval auto-sets approval recipient';
    ELSE
        RAISE WARNING '❌ Test 3 FAILED: Approval recipient not auto-set';
    END IF;

    -- Test 4: Create third contact and make it primary approval
    INSERT INTO property_contacts (
        property_id,
        name,
        email,
        position,
        is_primary_approval_recipient
    ) VALUES (
        v_property_id,
        'TEST CONTACT 3',
        'test3@example.com',
        'Test Position 3',
        true
    ) RETURNING id INTO v_contact3_id;

    -- Verify only contact 3 is primary approval
    IF (SELECT is_primary_approval_recipient FROM property_contacts WHERE id = v_contact1_id) = false AND
       (SELECT is_primary_approval_recipient FROM property_contacts WHERE id = v_contact3_id) = true THEN
        RAISE NOTICE '✅ Test 4 PASSED: Only one primary approval recipient allowed';
    ELSE
        RAISE WARNING '❌ Test 4 FAILED: Multiple primary approval recipients found';
    END IF;

    -- Test 5: Unset approval recipient and verify primary is also unset
    UPDATE property_contacts 
    SET is_approval_recipient = false
    WHERE id = v_contact3_id;

    IF (SELECT is_primary_approval_recipient FROM property_contacts WHERE id = v_contact3_id) = false THEN
        RAISE NOTICE '✅ Test 5 PASSED: Unsetting approval recipient auto-unsets primary';
    ELSE
        RAISE WARNING '❌ Test 5 FAILED: Primary not auto-unset';
    END IF;

    -- Cleanup
    DELETE FROM property_contacts WHERE id IN (v_contact1_id, v_contact2_id, v_contact3_id);
    
    RAISE NOTICE '🧹 Cleanup complete - test contacts removed';
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════';
    RAISE NOTICE '✅ ALL TRIGGER TESTS COMPLETED';
    RAISE NOTICE '════════════════════════════════════════════════════';
END $$;

-- Show any contacts that might have issues (should be none after tests)
SELECT 
    property_id,
    COUNT(*) as count,
    'Multiple subcontractors' as issue
FROM property_contacts
WHERE is_subcontractor_contact = true
GROUP BY property_id
HAVING COUNT(*) > 1

UNION ALL

SELECT 
    property_id,
    COUNT(*) as count,
    'Multiple AR contacts' as issue
FROM property_contacts
WHERE is_accounts_receivable_contact = true
GROUP BY property_id
HAVING COUNT(*) > 1

UNION ALL

SELECT 
    property_id,
    COUNT(*) as count,
    'Multiple primary approvals' as issue
FROM property_contacts
WHERE is_primary_approval_recipient = true
GROUP BY property_id
HAVING COUNT(*) > 1

UNION ALL

SELECT 
    property_id,
    COUNT(*) as count,
    'Multiple primary notifications' as issue
FROM property_contacts
WHERE is_primary_notification_recipient = true
GROUP BY property_id
HAVING COUNT(*) > 1;

-- If the above query returns no rows, all constraints are working correctly!
