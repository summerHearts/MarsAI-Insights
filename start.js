/**
 * 模型评测平台启动脚本
 * 这个脚本提供了一个交互式界面，允许用户选择不同的端口启动应用
 */

const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('');
console.log('=== 模型评测平台启动工具 ===');
console.log('');
console.log('请选择要使用的端口号:');
console.log('1) 3000 (默认)');
console.log('2) 3001');
console.log('3) 3002');
console.log('4) 8080');
console.log('5) 自定义端口');
console.log('');

rl.question('请输入选项 (1-5): ', (answer) => {
  let port;
  let cmd;

  switch(answer.trim()) {
    case '1':
      port = 3000;
      break;
    case '2':
      port = 3001;
      break;
    case '3':
      port = 3002;
      break;
    case '4':
      port = 8080;
      break;
    case '5':
      rl.question('请输入自定义端口号: ', (customPort) => {
        port = parseInt(customPort.trim(), 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.log('端口号无效，必须是1-65535之间的数字');
          rl.close();
          return;
        }
        startApp(port);
        rl.close();
      });
      return;
    default:
      console.log('无效选项，使用默认端口3000');
      port = 3000;
  }

  startApp(port);
  rl.close();
});

function startApp(port) {
  console.log(`启动应用，使用端口: ${port}`);
  
  // 使用子进程运行npm start命令
  const cmd = process.platform === 'win32' 
    ? `set PORT=${port} && npm start` 
    : `PORT=${port} npm start`;
  
  console.log(`执行命令: ${cmd}`);
  
  const child = exec(cmd, { cwd: __dirname });

  // 将子进程的输出流接到主进程
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  child.on('exit', (code) => {
    console.log(`应用已退出，退出码: ${code}`);
  });
} 