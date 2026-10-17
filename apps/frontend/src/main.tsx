import {createRoot} from 'react-dom/client';
import {BrowserRouter,useLocation} from 'react-router-dom';
import Home from './original/page';
import Login from './original/login/page';
import Portal from './original/portal/page';
import Dashboard from './original/dashboard/page';
import Admin from './original/admin/page';
import Concept from './original/concept/page';
import FlightLab from './original/flight-lab/page';
import Report from './original/report-render/page';
import {SessionGate} from './original/session';
import {InstallApp} from './components/install-app';
import {Recovery} from './recovery';
import './styles.css';
function App(){const {pathname,search}=useLocation();const params=Object.fromEntries(new URLSearchParams(search));let page;
switch(pathname){case '/':page=<Home/>;break;case '/login':page=<><Login searchParams={params}/><a className="recovery-link" href="/forgot-password">Forgot password?</a></>;break;case '/portal':page=<SessionGate><Portal searchParams={params}/></SessionGate>;break;case '/dashboard':page=<SessionGate><Dashboard searchParams={params}/></SessionGate>;break;case '/admin':page=<SessionGate admin><Admin/></SessionGate>;break;case '/report-render':page=<SessionGate><Report searchParams={params}/></SessionGate>;break;case '/concept':page=<Concept/>;break;case '/flight-lab':page=<FlightLab/>;break;case '/forgot-password':case '/reset-password':page=<Recovery/>;break;default:page=<main><h1>Page not found</h1><a href="/">Back to home</a></main>;}return <>{page}<InstallApp/></>}
createRoot(document.getElementById('root')!).render(<BrowserRouter><App/></BrowserRouter>);
