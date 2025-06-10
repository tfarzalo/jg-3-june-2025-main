-- Delete existing job phases
DELETE FROM job_phases;

-- Insert initial job phases
INSERT INTO job_phases (job_phase_label, color_light_mode, color_dark_mode, sort_order, order_index)
VALUES 
  ('Job Request', '#E5E7EB', '#374151', 1, 1),
  ('Work Order', '#FEF3C7', '#92400E', 2, 2),
  ('Pending Work Order', '#FEE2E2', '#991B1B', 3, 3),
  ('Invoicing', '#DCFCE7', '#166534', 4, 4),
  ('Completed', '#DBEAFE', '#1E40AF', 5, 5),
  ('Cancelled', '#F3F4F6', '#4B5563', 6, 6); 