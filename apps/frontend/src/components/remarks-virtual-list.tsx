import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { List, type RowComponentProps } from 'react-window';

type Choice = { value: string; label: string };
type Selection = { mode: 'include' | 'exclude'; values: Set<string> };
type Props = { items: Choice[]; selection: Selection; onToggle: (value: string, checked: boolean) => void };

function RemarkRow({ index, style, ariaAttributes, items, selection, onToggle }: RowComponentProps<Props>) {
  const item = items[index];
  const checked = selection.mode === 'include' ? selection.values.has(item.value) : !selection.values.has(item.value);
  return <div {...ariaAttributes} style={style}>
    <label title={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', padding: '6px 2px', boxSizing: 'border-box', cursor: 'pointer' }}>
      <input type="checkbox" data-remark-value={item.value} checked={checked}
        onChange={event => onToggle(item.value, event.target.checked)}
        style={{ flex: 'none', accentColor: '#ff2445' }} />
      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{item.label}</span>
    </label>
  </div>;
}

const roots = new WeakMap<HTMLElement, Root>();
function renderRemarksList(container: HTMLElement, props: Props) {
  let root = roots.get(container);
  if (!root) { root = createRoot(container); roots.set(container, root); }
  flushSync(() => root.render(<List key={(props.items[0]?.value || '') + ':' + props.items.length}
    rowComponent={RemarkRow} rowProps={props} rowCount={props.items.length} rowHeight={56}
    overscanCount={4} style={{ height: Math.min(250, props.items.length * 56), width: '100%' }} />));
}

declare global { interface Window { renderRemarksList: typeof renderRemarksList } }
window.renderRemarksList = renderRemarksList;
