const { exec } = require('child_process');
const fs = require('fs');
function next0905(){
  const now = new Date();
  // Colombia UTC-5
  const colombia = new Date(now.toLocaleString('en-US',{timeZone:'America/Bogota'}));
  let target = new Date(colombia);
  target.setHours(9); target.setMinutes(5); target.setSeconds(0); target.setMilliseconds(0);
  if(colombia >= target) target.setDate(target.getDate()+1);
  const diff = target.getTime() - colombia.getTime();
  return { target, diff };
}
const { target, diff } = next0905();
console.log(`Programado para ${target.toLocaleString('es-CO',{timeZone:'America/Bogota'})} (en ${Math.round(diff/1000/60)} min)`);
fs.writeFileSync('C:\\Users\\administrator\\Documents\\Default Project\\plataforma-compras\\clean-scheduled.log', `Programado ${new Date().toISOString()} -> ${target.toISOString()} diff ${diff}\n`);
setTimeout(()=>{
  console.log('Ejecutando limpieza...');
  exec('node "C:\\Users\\administrator\\Documents\\Default Project\\plataforma-compras\\scripts\\clean-test.js" >> "C:\\Users\\administrator\\Documents\\Default Project\\plataforma-compras\\clean.log" 2>&1', (err)=>{
    if(err) console.error(err);
    else console.log('Limpieza ejecutada');
    // segunda pasada por si quota aun no resetea
    setTimeout(()=> exec('node "C:\\Users\\administrator\\Documents\\Default Project\\plataforma-compras\\scripts\\clean-test.js" >> "C:\\Users\\administrator\\Documents\\Default Project\\plataforma-compras\\clean.log" 2>&1', ()=>{}), 5*60*1000);
  });
}, diff);
