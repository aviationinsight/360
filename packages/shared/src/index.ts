export const dashboardKeys = ['amos','aog','fak','marshaling','permits'] as const;
export type Dashboard = typeof dashboardKeys[number];
export type Role = 'admin' | 'employee' | 'general';
export interface Principal { id:string; name:string; role:Role; canExport:boolean; permissions:Record<Dashboard,boolean> }
