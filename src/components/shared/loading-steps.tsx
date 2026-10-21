import { Check, LoaderCircle, Circle } from 'lucide-react';
// Progress is provided by the caller's actual request state, never a timer.
export function LoadingSteps({label='Đang xử lý yêu cầu…',steps=['Chuẩn bị yêu cầu','Chờ dịch vụ trả kết quả','Kiểm tra và hiển thị kết quả'],current=1}:{label?:string;steps?:string[];current?:number}) {
  return <div className="loading-steps" role="status" aria-live="polite"><p>{label}</p><ol>{steps.map((step,index)=>{const Icon=index<current?Check:index===current?LoaderCircle:Circle;return <li key={step} className={index===current?'current':index<current?'complete':''} aria-current={index===current?'step':undefined}><Icon size={16} aria-hidden="true"/><span>{step}</span></li>;})}</ol></div>;
}
