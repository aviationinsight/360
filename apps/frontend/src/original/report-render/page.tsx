import ReportRender from './report-render';
export const dynamic='force-dynamic';
export default function Page({searchParams}:{searchParams:{dashboard?:string;from?:string;to?:string}}){
  const params=searchParams;
  return <ReportRender dashboard={params.dashboard||''} from={params.from||''} to={params.to||''}/>;
}
