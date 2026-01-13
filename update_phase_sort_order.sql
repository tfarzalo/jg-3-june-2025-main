-- Migration: Update job_phases sort_order
-- Purpose: 
-- 1. Remove deprecated 'Grading' phase
-- 2. Move 'Completed' phase to come BEFORE 'Invoicing' in the sequence
-- 
-- New sequence:
-- Job Request → Pending Work Order (if applicable) → Work Order → Completed → Invoicing → Cancelled → Archived
--
-- This ensures the workflow goes:
-- 1. Job Request (work is requested)
-- 2. Pending Work Order (if extra charges or notifications needed)
-- 3. Work Order (work is being done)
-- 4. Completed (work is finished)
-- 5. Invoicing (billing is processed)
-- 6. Cancelled (job was cancelled - terminal state)
-- 7. Archived (job is archived - terminal state, not accessible via UI navigation)

-- First, let's see the current sort_order values
-- SELECT job_phase_label, sort_order FROM job_phases ORDER BY sort_order;

DO $$
DECLARE
    invoicing_sort_order INTEGER;
    completed_sort_order INTEGER;
    grading_phase_id UUID;
    work_order_phase_id UUID;
    grading_exists BOOLEAN;
BEGIN
    -- Check if Grading phase exists
    SELECT EXISTS(SELECT 1 FROM job_phases WHERE job_phase_label = 'Grading') INTO grading_exists;
    
    IF grading_exists THEN
        -- Get the Grading phase ID
        SELECT id INTO grading_phase_id FROM job_phases WHERE job_phase_label = 'Grading';
        -- Get the Work Order phase ID (we'll redirect references to this)
        SELECT id INTO work_order_phase_id FROM job_phases WHERE job_phase_label = 'Work Order';
        
        RAISE NOTICE 'Grading phase ID: %', grading_phase_id;
        RAISE NOTICE 'Work Order phase ID: %', work_order_phase_id;
        
        -- First, update any jobs that are currently in Grading phase
        UPDATE jobs 
        SET current_phase_id = work_order_phase_id
        WHERE current_phase_id = grading_phase_id;
        RAISE NOTICE 'Moved jobs from Grading to Work Order phase';
        
        -- Update job_phase_changes: change from_phase_id references
        UPDATE job_phase_changes 
        SET from_phase_id = work_order_phase_id
        WHERE from_phase_id = grading_phase_id;
        RAISE NOTICE 'Updated from_phase_id references in job_phase_changes';
        
        -- Update job_phase_changes: change to_phase_id references
        UPDATE job_phase_changes 
        SET to_phase_id = work_order_phase_id
        WHERE to_phase_id = grading_phase_id;
        RAISE NOTICE 'Updated to_phase_id references in job_phase_changes';
        
        -- Now we can safely delete the Grading phase
        DELETE FROM job_phases WHERE job_phase_label = 'Grading';
        RAISE NOTICE 'Deleted Grading phase from job_phases table';
    ELSE
        RAISE NOTICE 'Grading phase does not exist - no deletion needed';
    END IF;

    -- Get current sort_order values for Invoicing and Completed
    SELECT sort_order INTO invoicing_sort_order FROM job_phases WHERE job_phase_label = 'Invoicing';
    SELECT sort_order INTO completed_sort_order FROM job_phases WHERE job_phase_label = 'Completed';
    
    -- Log current values
    RAISE NOTICE 'Current Invoicing sort_order: %', invoicing_sort_order;
    RAISE NOTICE 'Current Completed sort_order: %', completed_sort_order;
    
    -- Only swap if Invoicing currently comes before Completed
    IF invoicing_sort_order < completed_sort_order THEN
        -- Swap the values
        UPDATE job_phases SET sort_order = completed_sort_order WHERE job_phase_label = 'Invoicing';
        UPDATE job_phases SET sort_order = invoicing_sort_order WHERE job_phase_label = 'Completed';
        
        RAISE NOTICE 'Swapped sort_order values: Completed is now %, Invoicing is now %', invoicing_sort_order, completed_sort_order;
    ELSE
        RAISE NOTICE 'No swap needed - Completed already comes before Invoicing';
    END IF;
    
    -- Renumber all phases to ensure sequential ordering without gaps
    -- This is especially important after removing Grading
    WITH numbered_phases AS (
        SELECT id, job_phase_label, ROW_NUMBER() OVER (ORDER BY 
            CASE job_phase_label
                WHEN 'Job Request' THEN 1
                WHEN 'Pending Work Order' THEN 2
                WHEN 'Work Order' THEN 3
                WHEN 'Completed' THEN 4
                WHEN 'Invoicing' THEN 5
                WHEN 'Cancelled' THEN 6
                WHEN 'Archived' THEN 7
                ELSE 99
            END
        ) as new_sort_order
        FROM job_phases
    )
    UPDATE job_phases jp
    SET sort_order = np.new_sort_order
    FROM numbered_phases np
    WHERE jp.id = np.id;
    
    RAISE NOTICE 'Renumbered all phases to ensure sequential ordering';
END $$;

-- Verify the new order
SELECT job_phase_label, sort_order 
FROM job_phases 
ORDER BY sort_order;
