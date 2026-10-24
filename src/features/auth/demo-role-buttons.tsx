import {useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Handshake,ShieldCheck,Sprout,Truck} from 'lucide-react';
import {signInDemo,type DemoRole} from './demo-login';
const roles = [
  {role:'FARMER',label:'Nhà vườn',Icon:Sprout},
  {role:'BUYER',label:'Thu mua',Icon:Handshake},
  {role:'CARRIER',label:'Vận tải',Icon:Truck},
  {role:'ADMIN',label:'Admin',Icon:ShieldCheck},
] as const;
export function DemoRoleButtons({login=signInDemo}:{login?:(role:DemoRole)=>Promise<void>}) {
  const navigate=useNavigate();const lock=useRef(false);
  const [pending,setPending]=useState<DemoRole|null>(null);const [error,setError]=useState('');
  async function open(role:DemoRole) {
    if(lock.current)return;lock.current=true;setPending(role);setError('');
    try {await login(role);navigate('/role-home',{replace:true});}
    catch {setError('Chưa thể vào demo. Thử lại hoặc dùng Đăng nhập.');}
    finally {lock.current=false;setPending(null);}
  }
  return <div className="start-demo-access">
    <div className="start-demo-roles" role="group" aria-label="Vào nhanh tài khoản demo">
      <span className="start-demo-label">Demo</span>
      {roles.map(({role,label,Icon})=><button type="button" className="start-demo-role" key={role}
        aria-label={`Demo ${label}`} title={`Vào tài khoản demo ${label}`} disabled={pending!==null}
        aria-busy={pending===role} onClick={()=>void open(role)}><Icon size={15} aria-hidden="true"/>
        <span>{pending===role?'Đang vào…':label}</span></button>)}
    </div>
    {error && <p className="start-demo-error" role="alert">{error}</p>}
  </div>;
}
