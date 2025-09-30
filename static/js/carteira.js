// Canvas
const canvas = document.getElementById('carteira-canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 60;

// Saldo
let saldo = 100;
const saldoElement = document.getElementById('saldo');

// Nodes
const nodes = [
    {x:canvas.width/2, y:canvas.height/2, radius:30, pulse:0, id:'meu', highlight:0},
    {x:canvas.width/2+150, y:canvas.height/2-100, radius:20, pulse:0, id:'online', highlight:0, files:[], visible:false},
    {x:canvas.width/2+150, y:canvas.height/2+100, radius:20, pulse:0, id:'offline', highlight:0, files:[], visible:false}
];
nodes[0].connections = [];
nodes[1].connections = [];
nodes[2].connections = [];

const transactions = [];
const particleTrail = [];

// Cards
const tokenCard = document.getElementById('token-card');
const fileCard = document.getElementById('file-card');

// Função de hash de arquivo
function hashFile(file){
    let hash=0,i,chr;
    const str=file.name+file.size+file.lastModified;
    for(i=0;i<str.length;i++){
        chr=str.charCodeAt(i);
        hash=((hash<<5)-hash)+chr;
        hash|=0;
    }
    return 'f'+Math.abs(hash);
}

// --- Funções de desenho ---
function drawNode(node){
    if(!node.visible && node.id!=='meu') return;
    const pulseSize=node.radius+Math.sin(node.pulse)*6;
    const gradient=ctx.createRadialGradient(node.x,node.y,pulseSize/4,node.x,node.y,pulseSize);
    const color=node.id==='meu'?'#00ff99':node.id==='online'?'#00aaff':'#ffaa00';
    gradient.addColorStop(0,color); gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(node.x,node.y,pulseSize,0,Math.PI*2); ctx.fillStyle=gradient; ctx.fill(); ctx.closePath();
    ctx.beginPath(); ctx.arc(node.x,node.y,node.radius,0,Math.PI*2); ctx.strokeStyle=color; ctx.lineWidth=2; ctx.shadowColor=color; ctx.shadowBlur=15; ctx.stroke(); ctx.closePath();
    if(node.highlight>0) node.highlight-=0.05;
}

function drawConnections(){
    nodes.forEach(n=>{
        n.connections.forEach(t=>{
            ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(t.x,t.y);
            ctx.strokeStyle='rgba(0,255,153,0.3)'; ctx.lineWidth=2; ctx.shadowColor='#00ff99'; ctx.shadowBlur=6; ctx.stroke(); ctx.closePath();
        });
    });
}

function drawParticles(){
    particleTrail.forEach((p,i)=>{
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill(); ctx.closePath();
        p.x+=p.vx; p.y+=p.vy; p.life--;
        if(p.life<=0) particleTrail.splice(i,1);
    });
}

// --- Transações ---
function drawTransactions(){
    transactions.forEach((tx,i)=>{
        const {from,to,type,progress,file} = tx;
        const dx = to.x-from.x;
        const dy = to.y-from.y;
        const x = from.x + dx*progress + Math.sin(progress*Math.PI*2)*20;
        const y = from.y + dy*progress + Math.cos(progress*Math.PI*2)*20;

        particleTrail.push({x,y,size:4,color:type==='token'?'#00ff00':'#00aaff',vx:0,vy:0,life:20});

        ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fillStyle=type==='token'?'#00ff00':'#00aaff'; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=12; ctx.fill(); ctx.closePath();
        tx.progress+=0.02;

        if(tx.progress>=1){
            if(type==='token'){ saldo-=tx.amount; saldoElement.textContent=saldo+' EVAI'; to.highlight=1; }
            if(type==='dados' && file){
                const hash = hashFile(file);
                to.files.push({file,hash}); to.visible=true; to.highlight=1;
            }
            transactions.splice(i,1);
        }
    });
}

function animate(){
    ctx.fillStyle='rgba(6,16,16,1)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    drawConnections(); drawTransactions(); drawParticles();
    nodes.forEach(n=>{n.pulse+=0.05; drawNode(n);});
    requestAnimationFrame(animate);
}
animate();

// --- Eventos ---
document.getElementById('saldo-display').addEventListener('click', ()=>{
    tokenCard.classList.remove('hidden');
});

document.getElementById('token-cancel').addEventListener('click', ()=>{ tokenCard.classList.add('hidden'); });
document.getElementById('token-confirm').addEventListener('click', ()=>{
    const key=document.getElementById('token-key').value;
    const amount=parseInt(document.getElementById('token-amount').value)||0;
    if(key && amount>0){
        transactions.push({from:nodes[0],to:nodes[1],type:'token',progress:0,amount});
        tokenCard.classList.add('hidden');
    }
});

const fileInput=document.getElementById('file-input');
document.getElementById('send-dados').addEventListener('click',()=>{ fileInput.click(); });

fileInput.addEventListener('change',(e)=>{
    const file=e.target.files[0];
    if(file){
        fileCard.classList.remove('hidden');
        document.getElementById('file-info').textContent=`Arquivo: ${file.name} (${file.size} bytes)`;
        const sendOnlineBtn=document.getElementById('send-online');
        const sendOfflineBtn=document.getElementById('send-offline');
        sendOnlineBtn.onclick=()=>{
            transactions.push({from:nodes[0],to:nodes[1],type:'dados',progress:0,file});
            fileCard.classList.add('hidden');
        };
        sendOfflineBtn.onclick=()=>{
            transactions.push({from:nodes[0],to:nodes[2],type:'dados',progress:0,file});
            fileCard.classList.add('hidden');
        };
    }
});

document.getElementById('file-cancel').addEventListener('click',()=>{ fileCard.classList.add('hidden'); });


