import { supabase } from '../utils/supabase';

export const CONTACT_TEMPLATE_VARIABLES = [
  { variable: '{{primary_contact_name}}', description: 'Primary contact name' },
  { variable: '{{community_manager_name}}', description: 'Community manager name' },
  { variable: '{{maintenance_supervisor_name}}', description: 'Maintenance supervisor name' },
  { variable: '{{ap_contact_name}}', description: 'AP contact name' },
  { variable: '{{additional_contact_names}}', description: 'All additional property contact names' },
  { variable: '{{other_contact_names}}', description: 'All additional property contact names' },
];

export type ContactTemplateTokens = Record<string, string>;

const joinNames = (names: Array<string | null | undefined>) =>
  names.map((name) => name?.trim()).filter(Boolean).join(', ');

export async function fetchContactTemplateTokens(propertyId?: string | null): Promise<ContactTemplateTokens> {
  if (!propertyId) return {};

  const replacements: ContactTemplateTokens = {};

  const [{ data: property }, { data: customContacts }] = await Promise.all([
    supabase
      .from('properties')
      .select(`
        community_manager_name,
        maintenance_supervisor_name,
        primary_contact_name,
        ap_name
      `)
      .eq('id', propertyId)
      .maybeSingle(),
    supabase
      .from('property_contacts')
      .select('name, position')
      .eq('property_id', propertyId)
      .order('position', { ascending: true }),
  ]);

  const primaryContactName = property?.primary_contact_name || '';
  const communityManagerName = property?.community_manager_name || '';
  const maintenanceSupervisorName = property?.maintenance_supervisor_name || '';
  const apContactName = property?.ap_name || '';
  const additionalContactNames = joinNames((customContacts || []).map((contact) => contact.name));

  replacements.primary_contact_name = primaryContactName;
  replacements['primary_contact.name'] = primaryContactName;
  replacements.community_manager_name = communityManagerName;
  replacements['community_manager.name'] = communityManagerName;
  replacements.maintenance_supervisor_name = maintenanceSupervisorName;
  replacements['maintenance_supervisor.name'] = maintenanceSupervisorName;
  replacements.ap_contact_name = apContactName;
  replacements['ap_contact.name'] = apContactName;
  replacements.additional_contact_names = additionalContactNames;
  replacements.other_contact_names = additionalContactNames;

  return replacements;
}

export function replaceTemplateTokens(template: string, replacements: ContactTemplateTokens): string {
  let processed = template;
  Object.entries(replacements).forEach(([token, value]) => {
    const single = new RegExp(`\\{\\s*${escapeRegExp(token)}\\s*\\}`, 'gi');
    const double = new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, 'gi');
    processed = processed.replace(single, value).replace(double, value);
  });
  return processed;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
