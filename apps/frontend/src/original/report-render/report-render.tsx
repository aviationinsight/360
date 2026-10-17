'use client';
import {useEffect,useRef,useState} from 'react';
import {captureReport} from './capture-report';
export default function ReportRender({dashboard,from,to}:{dashboard:string;from:string;to:string}){
  const started=useRef(false),[image,setImage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    if(started.current)return;started.current=true;
    if(!['amos','fak','aog','marshaling'].includes(dashboard)||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)){setError('Invalid report period');return;}
    captureReport(dashboard,{from,to}).then(blob=>setImage(URL.createObjectURL(blob as Blob))).catch(e=>setError(e instanceof Error?e.message:String(e)));
  },[dashboard,from,to]);
  return <main style={{position:'fixed',inset:0,width:1920,height:1080,background:'#f7f8fb',overflow:'hidden'}}>
    {image?<img src={image} alt="Performance report" style={{display:'block',width:1920,height:1080}} onLoad={e=>e.currentTarget.id='report-ready'}/>:<p id={error?'report-failed':'report-loading'}>{error||'Preparing report…'}</p>}
  </main>;
}
