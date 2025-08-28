
/**
 * Determines the correct navigation destination based on user role
 * Subcontractors are directed to their dashboard, others to the default destination
 */
export function getNavigationDestination(
  defaultPath: string,
  isSubcontractor: boolean,
  subcontractorPath: string = '/dashboard/subcontractor'
): string {
  return isSubcontractor ? subcontractorPath : defaultPath;
}

/**
 * Gets the appropriate back navigation path for the current user
 * Subcontractors go to subcontractor dashboard, others to their respective list pages
 */
export function getBackNavigationPath(
  defaultPath: string,
  isSubcontractor: boolean
): string {
  return getNavigationDestination(defaultPath, isSubcontractor);
}

