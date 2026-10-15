<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cargando Plataforma...</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">

<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Poppins',sans-serif;}
body{
height:100vh;
display:flex;
justify-content:center;
align-items:center;
background:linear-gradient(-45deg,#6a040f,#9d0208,#d00000,#dc2f02,#e85d04);
background-size:400% 400%;
animation:bgAnim 16s ease infinite;
color:white;
overflow:hidden;
opacity:1;
}

/* Fondo animado */
@keyframes bgAnim{
0%{background-position:0% 50%}
50%{background-position:100% 50%}
100%{background-position:0% 50%}
}

/* Canvas */
#particles{position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;}

/* Loader contenedor */
.loader{
text-align:center;
padding:50px;
border-radius:24px;
background:rgba(255,255,255,.06);
backdrop-filter:blur(20px);
box-shadow:0 25px 70px rgba(0,0,0,.5);
animation:fadeIn 1s ease;
}

/* Logo con glow */
.logo{
width:140px;
margin-bottom:25px;
animation:float 4s ease-in-out infinite, glow 2.8s ease-in-out infinite;
}
@keyframes glow{
0%,100%{filter:drop-shadow(0 0 5px rgba(255,255,255,.3))}
50%{filter:drop-shadow(0 0 28px rgba(255,255,255,.9))}
}
@keyframes float{
0%,100%{transform:translateY(0)}
50%{transform:translateY(-16px)}
}

/* Loader circular 3D */
.circle{
width:100px;height:100px;margin:20px auto;
border-radius:50%;
border:4px solid rgba(255,255,255,.15);
border-top:4px solid white;
animation:spin 1.2s linear infinite;
box-shadow:0 0 35px rgba(255,255,255,.6);
}
@keyframes spin{to{transform:rotate(360deg)}}

/* Texto typewriter */
h1{font-weight:600;font-size:22px;min-height:30px;letter-spacing:.5px;}
#estado{opacity:.85;font-size:15px;margin-top:8px;}

/* Barra de progreso */
.bar{
width:280px;height:8px;
background:rgba(255,255,255,.18);
border-radius:30px;
overflow:hidden;
margin:20px auto 0 auto;
}
.fill{
height:100%;
width:0%;
background:linear-gradient(90deg,#fff,#ffdede,#fff);
background-size:200% 100%;
animation:shine 2s linear infinite;
box-shadow:0 0 20px rgba(255,255,255,.5);
}
@keyframes shine{
0%{background-position:200% 0}
100%{background-position:-200% 0}
}

/* fade out */
.fade-out{animation:out 1s forwards;}
@keyframes out{to{opacity:0;transform:scale(1.1)}}

@keyframes fadeIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
</style>
</head>

<body>
<canvas id="particles"></canvas>

<div class="loader" id="loader">
<img src="img/logo.png" class="logo">
<h1 id="texto"></h1>
<div class="circle"></div>
<p id="estado">Iniciando...</p>
<div class="bar"><div class="fill" id="fill"></div></div>
</div>

<audio id="startupSound" src="audio/soundreality-hold-on-beat-408795.mp3" autoplay></audio>


<script>
/* ================= TEXTO TYPEWRITER ================= */
const mensajes=[
"Iniciando plataforma",
"Cargando módulos del sistema",
"Conectando base de datos",
"Verificando cupos disponibles",
"Optimizando experiencia",
"Todo listo"
];

let i=0,j=0;
const texto=document.getElementById("texto");
const estado=document.getElementById("estado");
const fill=document.getElementById("fill");
const sound=document.getElementById("startupSound");

function escribir(){
if(i<mensajes.length){
    if(j<mensajes[i].length){
        texto.innerHTML+=mensajes[i][j];
        j++;
        setTimeout(escribir,30);
    }else{
        estado.innerText="Paso "+(i+1)+" de "+mensajes.length;
        i++; j=0;
        texto.innerHTML="";
        setTimeout(escribir,600);
    }
}else finalizar();
}
escribir();

/* ================= PROGRESO REAL ================= */
let progreso=0;
const intervalo=setInterval(()=>{
progreso+=100/(mensajes.length*12);
fill.style.width=progreso+"%";
},70);

/* ================= FINAL CINEMATIC ================= */
function finalizar(){
clearInterval(intervalo);
setTimeout(()=>{
// reproducir sonido
if(sound) sound.play().catch(()=>{});
// fade out
document.getElementById("loader").classList.add("fade-out");
document.body.style.transition="opacity .8s ease";
document.body.style.opacity="0";
// transición final épica
setTimeout(()=>location.href="home.html",800);
},500);
}

/* ================= PARTICULAS 3D CON LINEAS ================= */
const canvas=document.getElementById("particles");
const ctx=canvas.getContext("2d");

function resize(){canvas.width=innerWidth; canvas.height=innerHeight;}
resize();
addEventListener("resize",resize);

let p=[];
for(let k=0;k<100;k++){
p.push({
x:Math.random()*canvas.width,
y:Math.random()*canvas.height,
z:Math.random()*1.5+0.5,
vx:(Math.random()-.5)*0.5,
vy:(Math.random()-.5)*0.5
});
}

function draw(){
ctx.clearRect(0,0,canvas.width,canvas.height);

/* puntos 3D */
p.forEach(pt=>{
pt.x+=pt.vx; pt.y+=pt.vy;
if(pt.x<0||pt.x>canvas.width)pt.vx*=-1;
if(pt.y<0||pt.y>canvas.height)pt.vy*=-1;
ctx.beginPath();
ctx.arc(pt.x,pt.y,pt.z*2,0,Math.PI*2);
ctx.fillStyle="rgba(255,255,255,"+pt.z/2+")";
ctx.fill();
});

/* lineas conectadas */
for(let a=0;a<p.length;a++){
for(let b=a+1;b<p.length;b++){
let dx=p[a].x-p[b].x, dy=p[a].y-p[b].y;
let d=Math.sqrt(dx*dx+dy*dy);
if(d<140){
ctx.strokeStyle="rgba(255,255,255,"+(1-d/140)*0.25+")";
ctx.lineWidth=.7;
ctx.beginPath();
ctx.moveTo(p[a].x,p[a].y);
ctx.lineTo(p[b].x,p[b].y);
ctx.stroke();
}
}
}
requestAnimationFrame(draw);
}
draw();
</script>
</body>
</html>
