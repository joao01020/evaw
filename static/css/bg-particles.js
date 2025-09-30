const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random()*canvas.width;
    this.y = Math.random()*canvas.height;
    this.vx = (Math.random()-0.5)*0.3;
    this.vy = (Math.random()-0.5)*0.3;
    this.radius = Math.random()*2+1;
    this.alpha = Math.random()*0.5+0.2;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fillStyle = `rgba(0,255,195,${this.alpha})`;
    ctx.fill();
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.reset();
    this.draw();
  }
}

const particles = [];
for(let i=0;i<120;i++) particles.push(new Particle());

function animate() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  particles.forEach(p=>p.update());
  requestAnimationFrame(animate);
}

animate();
window.addEventListener('resize',()=>{
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
