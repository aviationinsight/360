import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('apps/backend/private/dashboard-source.html','utf8');
const html=JSON.parse(source.match(/<script type="application\/json" id="data-amos">([\s\S]*?)<\/script>/)![1]);
const hour=vm.runInNewContext('('+html.match(/function parseAmosHour\(value\)\{[\s\S]*?\n\}/)![0]+')',{Date});
test('AMOS times support Excel fractions, full serials, clock text and midnight',()=>{
 for(const [value,expected] of [[0,0],[1/24,1],[8/24,8],[0.14722222222222223,3],[12/24,12],[23/24,23],[46000+17/24,17],['08:30',8],['3:15 PM',15],['12:00 AM',0],['12:00 PM',12],['2026-10-12T17:45:00',17],['0.5',12],[new Date(2026,9,12,19,30),19]])assert.equal(hour(value),expected,String(value));
 for(const value of [null,undefined,'',NaN,Infinity,-1,'bad time','25:00','00:30 PM'])assert.equal(hour(value),-1,String(value));
});
test('hourly curve controls stay inside each segment and cannot dip below zero',()=>{
 const path=vm.runInNewContext('('+html.match(/function smoothPath\(points\)\{[^\n]+/)![0]+')');
 const result=path([[0,0],[10,100],[20,100],[30,20]]);
 const segments=[...result.matchAll(/ C ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)/g)];assert.equal(segments.length,3);
 for(const segment of segments)for(const index of [2,4,6])assert.ok(Number(segment[index])>=0&&Number(segment[index])<=100);
 assert.equal(Number(segments[1][2]),100);assert.equal(Number(segments[1][4]),100);
});
