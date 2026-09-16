export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: value % 100 ? 2 : 0 }).format(value / 100);

export function Icon({ name, size = 20, ...props }) {
  const paths = {
    cloud: <><path d="M7 18a5 5 0 1 1 1-10 6 6 0 0 1 11 3 3.5 3.5 0 0 1 0 7z"/><path d="m4 3 16 18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    expenses: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    balances: <><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/></>,
    purse: <><path d="M19 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v11H6a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v5h5"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    back: <path d="M19 12H5m5-5-5 5 5 5"/>,
    down: <path d="m6 9 6 6 6-6"/>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M18 18A8 8 0 0 1 5 15"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    trip: <><path d="m3 7 6-3 6 3 6-3v16l-6 3-6-3-6 3zM9 4v16m6-13v16"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.expenses}</svg>;
}

export function EmptyState({ icon = 'expenses', title, children }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={26}/></span><h3>{title}</h3><p>{children}</p></div>;
}

export const isPrivate = entry => entry.splitAmong?.length === 1 && entry.splitAmong[0] === entry.recordedBy;
export const entryDate = entry => new Date(entry.clientCreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
