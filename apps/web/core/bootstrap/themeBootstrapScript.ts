/**
 * Inline script injected before React hydrates. Reads persisted settings/session
 * from localStorage and sets <html> attrs + CSS vars so the first paint matches
 * the user's theme (no flash of default palette).
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){
try{
var root=document.documentElement;
var board={
classic:{l:"#eef0f4",d:"#7c8aa5",m:"#7be0b3"},
chalkboard:{l:"#5b6b63",d:"#2f3b38",m:"#9fe3c5"},
marble:{l:"#f3efe9",d:"#b9b2a7",m:"#9ad0c2"},
tournament:{l:"#e9eef0",d:"#6a9b78",m:"#f2c14e"},
wooden:{l:"#e8cfa6",d:"#a9743f",m:"#7fd1a8"},
neon:{l:"#1f2238",d:"#3a2f6b",m:"#41e0c8"},
paper:{l:"#faf7f0",d:"#cdbf9c",m:"#8fd0b0"},
midnight:{l:"#3a3f5c",d:"#1c2036",m:"#5aa9e6"},
violet:{l:"#ede7f6",d:"#b9a8e6",m:"#7be0b3"},
slate:{l:"#e8eef7",d:"#9bb8d3",m:"#5aa9e6"},
forest:{l:"#e9efe1",d:"#a3c293",m:"#7fd1a8"}
};
var darkApp={midnight:1};
var raw=localStorage.getItem("chessschool.settings");
if(raw){
var p=JSON.parse(raw);
var s=(p&&p.state)||p||{};
var bt=s.boardTheme||"classic";
var st=s.schoolTheme||"university";
var at=s.appTheme||"default";
var b=board[bt]||board.classic;
var cb=s.colorblind&&s.colorblind!=="none";
if(cb)b=board.slate;
root.dataset.boardTheme=bt;
root.dataset.schoolTheme=st;
root.dataset.appTheme=at;
root.style.colorScheme=darkApp[at]?"dark":"light";
root.style.setProperty("--board-light",b.l);
root.style.setProperty("--board-dark",b.d);
root.style.setProperty("--board-move",b.m);
if(cb){
root.dataset.cb=s.colorblind;
root.style.setProperty("--board-highlight","#f2c14e");
}
if(s.reducedMotion)root.dataset.rm="1";
if(s.highContrast)root.dataset.contrast="high";
if(s.textScale&&s.textScale!==1)root.style.fontSize=Math.round(s.textScale*100)+"%";
}
var sess=localStorage.getItem("chessschool.session");
if(sess){
var sp=JSON.parse(sess);
var a=(sp&&sp.state)||sp;
if(a&&a.authed===true)root.dataset.session="auth";
else if(a&&a.authed===false)root.dataset.session="guest";
}
}catch(e){}
})();`;
