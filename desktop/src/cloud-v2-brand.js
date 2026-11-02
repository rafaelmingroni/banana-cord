/* Mingrx Cloud visible identity. Internal Banana* object/event names stay only for migration compatibility. */
(() => {
  const gate = document.getElementById('cloudGate');
  if (!gate) return;
  const brand = gate.querySelector('.cloud-brand');
  if (brand) brand.innerHTML = '<img src="../assets/mingrx.svg" alt="Mingrx"><div><h1>Mingrx</h1><p>Conta Mingrx</p></div>';
  const missing = document.getElementById('cloudConfigMissing');
  if (missing) {
    const h = missing.querySelector('h2'); if (h) h.textContent = 'Mingrx Cloud ainda não configurado';
    const p = missing.querySelector('p'); if (p) p.textContent = 'Este build precisa da configuração pública do projeto Firebase para conectar contas e comunidades.';
    const small = missing.querySelector('small'); if (small) small.textContent = 'A configuração é validada automaticamente antes de uma Release oficial.';
  }
  const loading = document.querySelector('#cloudLoading p');
  if (loading) loading.textContent = 'Entrando no Mingrx…';
})();
