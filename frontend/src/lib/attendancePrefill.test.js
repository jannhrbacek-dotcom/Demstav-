import { attendanceSuggestion, recurringWork } from './attendancePrefill';
const rec = {id:'r1',date:'2026-10-30',machine:'L566',billing:[{start:'',end:''}],status:'draft'};
const ev = (kind,time,extra={}) => ({id:kind+time,employee_id:'u1',effective_at:`2026-10-30T${time}:00Z`,kind,status:'verified',workplace_id:'w1',workplace_name:'Struskárna',...extra});
const pair = [ev('arrival','05:00'),ev('departure','14:00')];
test('uses approved Prague times only as an explicit employee shift proposal',()=>{
  expect(attendanceSuggestion(pair,rec,'u1')).toEqual({intervals:[{start:'06:00',end:'15:00'}],workplaceId:'w1',site:'Struskárna',reason:''});
  expect(rec.billing).toEqual([{start:'',end:''}]);
});
test('preserves filled, partial and confirmed records',()=>{
  for(const billing of [[{start:'07:00',end:'16:00'}],[{start:'07:00',end:''}]]) expect(attendanceSuggestion(pair,{...rec,billing},'u1').reason).toBe('filled');
  expect(attendanceSuggestion(pair,{...rec,status:'confirmed'},'u1').reason).toBe('filled');
});
test('does not duplicate a whole shift for a second machine',()=>{
  expect(attendanceSuggestion(pair,rec,'u1',[{...rec,id:'other',machine:'L120',billing:[{start:'06:00',end:'12:00'}]}]).reason).toBe('multiple');
});
test('does not estimate open shift end or import another employees data',()=>{
  expect(attendanceSuggestion([pair[0]],rec,'u1').intervals).toEqual([{start:'06:00',end:''}]);
  expect(attendanceSuggestion([pair[0]],rec,'u1').reason).toBe('open');
  expect(attendanceSuggestion(pair,rec,'u2').reason).toBe('missing');
  expect(attendanceSuggestion(pair,{...rec,owner_id:'u2'},'u1').reason).toBe('owner');
});
test('pending review blocks proposal and rejected events cannot complete it',()=>{
  expect(attendanceSuggestion([pair[0],{...pair[1],status:'pending_review'}],rec,'u1').reason).toBe('unverified');
  expect(attendanceSuggestion([pair[0],{...pair[1],status:'rejected'}],rec,'u1').reason).toBe('open');
});
test('keeps split shifts, does not turn breaks or transfers into extra arrivals',()=>{
  const es=[ev('arrival','05:00'),ev('break_start','08:00'),ev('break_end','08:15'),ev('travel_start','09:00'),ev('arrival','09:30'),ev('departure','10:00'),ev('arrival','11:00'),ev('departure','14:00')];
  expect(attendanceSuggestion(es,rec,'u1').intervals).toEqual([{start:'06:00',end:'11:00'},{start:'12:00',end:'15:00'}]);
});
test('rejects broken sequence and ambiguous cross-date shifts',()=>{
  expect(attendanceSuggestion([pair[1]],rec,'u1').reason).toBe('sequence');
  expect(attendanceSuggestion([pair[0],ev('arrival','08:00'),pair[1]],rec,'u1').reason).toBe('sequence');
  expect(attendanceSuggestion(pair,{...rec,date:'2026-10-29'},'u1').reason).toBe('missing');
});
test('recurrence ranks confirmed same-machine work, never service, future or other user text',()=>{
  const rs=[{...rec,id:'old1',status:'confirmed',work:'Obsluha linky',serviceDescription:'Oprava hydrauliky'}, {...rec,id:'old2',status:'confirmed',work:'Obsluha linky'}, {...rec,id:'old3',status:'confirmed',work:'Nakládka'}, {...rec,id:'other',owner_id:'u2',status:'confirmed',work:'Cizí'}, {...rec,id:'future',date:'2026-11-01',status:'confirmed',work:'Budoucí'},{...rec,id:'draft',work:'Neověřené'}];
  expect(recurringWork(rs,rec,'u1')).toEqual(['Obsluha linky','Nakládka','Odvoz od třídiče']);
  expect(recurringWork(rs,{...rec,machine:''},'u1')).toEqual([]);
});

test('completes a matching partial arrival after departure without overwriting manual times',()=>{
  expect(attendanceSuggestion(pair,{...rec,billing:[{start:'06:00',end:''}]},'u1').intervals).toEqual([{start:'06:00',end:'15:00'}]);
  expect(attendanceSuggestion([pair[0]],{...rec,billing:[{start:'06:00',end:''}]},'u1').reason).toBe('filled');
});
