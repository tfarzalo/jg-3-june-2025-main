-- Migration: Fix all_contacts_view to use new contact_status enum
-- Date: 2025-11-18

CREATE OR REPLACE VIEW all_contacts_view AS
SELECT
    c.id as contact_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.company,
    c.job_title,
    c.address,
    c.notes as contact_notes,
    c.tags,
    c.created_at as contact_created_at,
    c.updated_at as contact_updated_at,
    c.last_contacted_at,
    c.status as status_name,
    cs.color as status_color,
    c.avatar_url,
    c.property_id,
    p.name as property_name,
    p.address as property_address,
    c.assigned_to,
    prof.full_name as assigned_to_name,
    l.id as lead_id,
    l.form_id,
    lf.name as form_name,
    l.form_data,
    l.source_url,
    l.notes as lead_notes,
    l.created_at as lead_created_at,
    l.updated_at as lead_updated_at
FROM 
    contacts c
LEFT JOIN 
    leads l ON c.lead_id = l.id
LEFT JOIN 
    lead_forms lf ON l.form_id = lf.id
LEFT JOIN 
    properties p ON c.property_id = p.id
LEFT JOIN 
    profiles prof ON c.assigned_to = prof.id
LEFT JOIN
    (VALUES
        ('Lead', '#FBBF24'),
        ('General Contact', '#60A5FA'),
        ('Client', '#34D399'),
        ('Proposal Sent', '#A78BFA'),
        ('Dead', '#F87171'),
        ('Customer', '#4ADE80'),
        ('Other', '#9CA3AF')
    ) AS cs(status, color) ON c.status::text = cs.status;
