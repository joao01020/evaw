(function(){
  const canvas = document.getElementById('ecosystem-canvas');
  const ctx = canvas.getContext('2d');
  const cardsRoot = document.getElementById('cards-root');
  const audioPlayer = document.getElementById('audio-player');

  function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  let wallet = {
    id: 1,
    name: 'Minha Carteira',
    role: 'USER',
    balance: 50,
    files: [],
    availableTracks: [],
    x: canvas.width/2,
    y: canvas.height/2,
    pulse: 0
  };

  makeCard(wallet);

  function makeCard(node){
    const card = document.createElement('div');
    card.className = 'wallet-card visible';
    card.id = `card-${node.id}`;
    card.innerHTML = `
      <div class="card-header">
        <div><small class="name">${escapeHtml(node.name)}</small></div>
        <div><div class="badge role">${node.role}</div></div>
      </div>
      <div><small>Saldo:</small> <span class="balance">${node.balance.toFixed(2)}</span> EVAW</div>
      <div class="available-area">${node.availableTracks.length>0?'<small>Ouvindo Música:</small>':''}</div>
      <div class="drop-area">Arraste seus arquivos aqui</div>
      <div class="reactions">
        <button data-emoji="❤️">❤️</button>
        <button data-emoji="🔥">🔥</button>
        <button data-emoji="👍">👍</button>
        <button data-emoji="⭐">⭐</button>
      </div>
    `;
    cardsRoot.appendChild(card);

    const dropArea = card.querySelector('.drop-area');
    dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('dragover'); });
    dropArea.addEventListener('dragleave', e => { e.preventDefault(); dropArea.classList.remove('dragover'); });
    dropArea.addEventListener('drop', e => {
      e.preventDefault(); dropArea.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files);
      files.forEach(f => {
        const trk = { id:'t'+Math.random().toString(36).slice(2,9), name:f.name, file:f };
        node.availableTracks.push(trk);
        node.files.push(trk);
      });
      updateCard(node);
    });

    card.querySelectorAll('.reactions button').forEach(btn=>{
      btn.addEventListener('click', () => sendReaction(node, btn.getAttribute('data-emoji')));
    });

    updateCard(node);
  }

  const reactionValues = { '❤️': 0.05, '🔥': 0.1, '👍': 0.02, '⭐': 0.2 };

  function sendReaction(targetNode, emoji){
    const value = reactionValues[emoji]||0.01;
    if(wallet.balance<value){ return; }
    wallet.balance -= value;
    targetNode.balance += value;
    updateCard(wallet);
    updateCard(targetNode);
  }

  function updateCard(node){
    const card = document.getElementById(`card-${node.id}`);
    if(!card) return;
    card.querySelector('.balance').textContent = node.balance.toFixed(2);

    const avail = card.querySelector('.available-area');
    avail.innerHTML='';
    node.availableTracks.forEach(track => {
      const wrapper = document.createElement('div');
      wrapper.style.display='flex'; wrapper.style.justifyContent='space-between';
      wrapper.innerHTML = `<span>${escapeHtml(track.name)}</span><div>
        <button class="btn-play">Ouvir</button>
      </div>`;
      avail.appendChild(wrapper);
      wrapper.querySelector('.btn-play').addEventListener('click', () => {
        audioPlayer.src = URL.createObjectURL(track.file);
        audioPlayer.play();
      });
    });
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function loop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const size = 18 + Math.log(1+wallet.balance)*4 + wallet.files.length*2;
    wallet.pulse += 0.06;
    const pulseSize = size + Math.sin(wallet.pulse)*4;

    ctx.beginPath();
    ctx.arc(wallet.x, wallet.y, pulseSize, 0, Math.PI*2);
    ctx.fillStyle = '#00ff99';
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc(wallet.x, wallet.y, pulseSize+4, 0, Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,0.12)';
    ctx.lineWidth=2;
    ctx.stroke();
    ctx.closePath();

    ctx.fillStyle='#000';
    ctx.font='10px Consolas';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(wallet.id, wallet.x, wallet.y);

    requestAnimationFrame(loop);
  }

  loop();

})();
