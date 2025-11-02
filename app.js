document.getElementById('calculate').addEventListener('click', () => {
  if (!logData || !veOld) {
    setStatus('statusCalc','⚠️ Загрузите лог и VE таблицу','orange');
    return;
  }
  
  setStatus('statusCalc','⚙️ Рассчитываем...','var(--muted)');
  
  // Добавляем задержку чтобы UI обновился
  setTimeout(() => {
    try {
      console.log('Starting calculation with:', logData.length, 'log points, VE table:', veOld.rows + 'x' + veOld.cols);
      
      result = calculateVE(logData, veOld);
      
      setStatus('statusCalc','✅ Расчёт завершён','#7BE495');
      renderResult(result);
      
      const ex = document.getElementById('export');
      if (ex) { 
        ex.disabled = false; 
        ex.classList.remove('disabled'); 
      }
    } catch (err) {
      console.error('Calculation error:', err);
      setStatus('statusCalc',`❌ Ошибка: ${err.message}`,'#ff6b6b');
      setDebug('Ошибка: ' + err.message + '\nStack: ' + (err.stack || 'нет'));
    }
  }, 100);
});
