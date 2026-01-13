-- Sample email templates for the enhanced notification system
-- This includes combination templates for various scenarios

-- Insert sample email templates with combination triggers
INSERT INTO email_templates (name, subject, body, template_type, trigger_phase, template_category, auto_include_photos, photo_types, is_active, created_by) VALUES

-- Extra Charges Only Templates
('Extra Charges - Professional', 'Extra Charges Approval Request - Job #{{job_number}}', 'Dear {{property_name}},

I hope this email finds you well. I am writing to request approval for additional work that has been identified during the painting project at {{property_address}}, Unit {{unit_number}}.

**Extra Work Required:**
{{extra_charges_description}}

**Additional Details:**
• Additional Hours: {{extra_hours}} hours
• Estimated Cost: ${{estimated_cost}}
• Work Order: {{work_order_number}}

This additional work is necessary to ensure the highest quality finish and address conditions that were not apparent during the initial assessment.

{{approval_button}}

Please review the details above and approve this additional work at your earliest convenience. If you have any questions or concerns, please don''t hesitate to contact me directly.

Thank you for your time and consideration.

Best regards,
JG Painting Pros Inc.', 'approval', 'extra_charges', 'property_notification', true, ARRAY['before', 'after'], true, '00000000-0000-0000-0000-000000000000'),

-- Sprinkler Paint Only Templates
('Sprinkler Paint - Standard', 'Sprinkler Paint Work Completed - Job #{{job_number}}', 'Dear {{property_name}},

I am pleased to inform you that the sprinkler paint work has been completed at {{property_address}}, Unit {{unit_number}}.

**Work Completed:**
• Sprinkler heads painted to match ceiling color
• Professional finish applied
• All sprinkler systems tested and functional

**Project Details:**
• Work Order: {{work_order_number}}
• Completion Date: {{completion_date}}
• Job Type: {{job_type}}

The sprinkler paint work has been completed to professional standards and all systems remain fully functional. Photos of the completed work are attached for your review.

If you have any questions or need additional information, please don''t hesitate to contact me.

Best regards,
JG Painting Pros Inc.', 'notification', 'sprinkler_paint', 'property_notification', true, ARRAY['sprinkler', 'after'], true, '00000000-0000-0000-0000-000000000000'),

-- Drywall Repairs Only Templates
('Drywall Repairs - Standard', 'Drywall Repair Work Completed - Job #{{job_number}}', 'Dear {{property_name}},

I am pleased to inform you that the drywall repair work has been completed at {{property_address}}, Unit {{unit_number}}.

**Work Completed:**
• Drywall damage assessment and repair
• Professional patching and sanding
• Paint-ready surface preparation

**Project Details:**
• Work Order: {{work_order_number}}
• Completion Date: {{completion_date}}
• Job Type: {{job_type}}

The drywall repairs have been completed to professional standards and the surface is ready for painting. Photos of the completed work are attached for your review.

If you have any questions or need additional information, please don''t hesitate to contact me.

Best regards,
JG Painting Pros Inc.', 'notification', 'drywall_repairs', 'property_notification', true, ARRAY['repair', 'after'], true, '00000000-0000-0000-0000-000000000000'),

-- Combination Templates
('Extra Charges + Sprinkler Paint', 'Extra Charges & Sprinkler Paint Approval - Job #{{job_number}}', 'Dear {{property_name}},

I hope this email finds you well. I am writing to request approval for additional work that has been identified during the painting project at {{property_address}}, Unit {{unit_number}}.

**Extra Work Required:**
{{extra_charges_description}}

**Additional Work Includes:**
• Sprinkler head painting to match ceiling color
• Professional finish application
• Sprinkler system testing

**Additional Details:**
• Additional Hours: {{extra_hours}} hours
• Estimated Cost: ${{estimated_cost}}
• Work Order: {{work_order_number}}

This additional work is necessary to ensure the highest quality finish and address both the extra charges and sprinkler paint requirements.

{{approval_button}}

Please review the details above and approve this additional work at your earliest convenience. If you have any questions or concerns, please don''t hesitate to contact me directly.

Thank you for your time and consideration.

Best regards,
JG Painting Pros Inc.', 'approval', 'extra_charges_sprinkler', 'property_notification', true, ARRAY['before', 'after', 'sprinkler'], true, '00000000-0000-0000-0000-000000000000'),

('Extra Charges + Drywall Repairs', 'Extra Charges & Drywall Repairs Approval - Job #{{job_number}}', 'Dear {{property_name}},

I hope this email finds you well. I am writing to request approval for additional work that has been identified during the painting project at {{property_address}}, Unit {{unit_number}}.

**Extra Work Required:**
{{extra_charges_description}}

**Additional Work Includes:**
• Drywall damage assessment and repair
• Professional patching and sanding
• Paint-ready surface preparation

**Additional Details:**
• Additional Hours: {{extra_hours}} hours
• Estimated Cost: ${{estimated_cost}}
• Work Order: {{work_order_number}}

This additional work is necessary to ensure the highest quality finish and address both the extra charges and drywall repair requirements.

{{approval_button}}

Please review the details above and approve this additional work at your earliest convenience. If you have any questions or concerns, please don''t hesitate to contact me directly.

Thank you for your time and consideration.

Best regards,
JG Painting Pros Inc.', 'approval', 'extra_charges_drywall', 'property_notification', true, ARRAY['before', 'after', 'repair'], true, '00000000-0000-0000-0000-000000000000'),

('Sprinkler + Drywall Combined', 'Sprinkler Paint & Drywall Repairs Completed - Job #{{job_number}}', 'Dear {{property_name}},

I am pleased to inform you that the sprinkler paint and drywall repair work has been completed at {{property_address}}, Unit {{unit_number}}.

**Work Completed:**
• Sprinkler heads painted to match ceiling color
• Drywall damage assessment and repair
• Professional patching and sanding
• Paint-ready surface preparation
• All sprinkler systems tested and functional

**Project Details:**
• Work Order: {{work_order_number}}
• Completion Date: {{completion_date}}
• Job Type: {{job_type}}

Both the sprinkler paint and drywall repair work have been completed to professional standards. Photos of the completed work are attached for your review.

If you have any questions or need additional information, please don''t hesitate to contact me.

Best regards,
JG Painting Pros Inc.', 'notification', 'sprinkler_drywall', 'property_notification', true, ARRAY['sprinkler', 'repair', 'after'], true, '00000000-0000-0000-0000-000000000000'),

('All Combined - Complete Package', 'Complete Work Package Approval - Job #{{job_number}}', 'Dear {{property_name}},

I hope this email finds you well. I am writing to request approval for a comprehensive work package that has been identified during the painting project at {{property_address}}, Unit {{unit_number}}.

**Complete Work Package Includes:**
{{extra_charges_description}}

**Additional Work Components:**
• Sprinkler head painting to match ceiling color
• Drywall damage assessment and repair
• Professional patching and sanding
• Paint-ready surface preparation
• Sprinkler system testing

**Package Details:**
• Additional Hours: {{extra_hours}} hours
• Estimated Cost: ${{estimated_cost}}
• Work Order: {{work_order_number}}

This comprehensive work package ensures the highest quality finish and addresses all identified requirements in a coordinated manner.

{{approval_button}}

Please review the details above and approve this complete work package at your earliest convenience. If you have any questions or concerns, please don''t hesitate to contact me directly.

Thank you for your time and consideration.

Best regards,
JG Painting Pros Inc.', 'approval', 'all_combined', 'property_notification', true, ARRAY['before', 'after', 'sprinkler', 'repair'], true, '00000000-0000-0000-0000-000000000000'),

('General Property Notification', 'Property Work Update - Job #{{job_number}}', 'Dear {{property_name}},

I hope this email finds you well. I am writing to provide you with an update on the painting project at {{property_address}}, Unit {{unit_number}}.

**Project Status:**
The work is progressing well and we wanted to keep you informed of the current status.

**Project Details:**
• Work Order: {{work_order_number}}
• Scheduled Date: {{scheduled_date}}
• Job Type: {{job_type}}
• Current Phase: {{job_phase}}

We will continue to keep you updated on the progress and will notify you when the work is completed.

If you have any questions or need additional information, please don''t hesitate to contact me.

Best regards,
JG Painting Pros Inc.', 'notification', 'general', 'property_notification', false, ARRAY[], true, '00000000-0000-0000-0000-000000000000');
