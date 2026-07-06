function calcMagnification(){const f=+$('focal').value||180,b=+$('bellows').value||345;return Math.max(0,b/f-1)}
function updateMagnificationField(){
  const mag = calcMagnification();
  if($("magnification")) $("magnification").value = mag.toFixed(2);
  if($("magHelp")){
    const f = +$("focal").value || 0;
    const b = +$("bellows").value || 0;
    $("magHelp").textContent = `撮影倍率 = 蛇腹長 ${b}mm ÷ 焦点距離 ${f}mm − 1 = ${mag.toFixed(2)}×`;
  }
}

function getFNumber(){const c=+$('fnumCustom').value;return c>0?c:(+$('fnum').value||16)}function effectiveFNumber(){return getFNumber()*(1+calcMagnification())}function focusAngleFor(s){return s.camera+s.front*1.15+s.rear*.75}function guideTextFor(d){const a=Math.abs(d);if(a<2)return'OK';return(d>0?'+':'-')+a.toFixed(1)+'°'}function updateInfo(){
  updateMagnificationField();$('infoMag').textContent=calcMagnification().toFixed(2)+'×';$('infoF').textContent='F'+getFNumber();$('infoEffF').textContent='F'+effectiveFNumber().toFixed(1);$('infoCoC').textContent=(+$('coc').value).toFixed(3)+'mm'}
