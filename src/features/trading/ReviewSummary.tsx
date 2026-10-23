import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RatingStars } from '../../components/shared/rating-stars';
import { supabase } from '../../lib/supabase';

interface Summary { average: number | null; count: number; recent: {id:string;rating:number;comment:string;reviewer_name:string;created_at:string}[] }
export function ReviewSummary({ userId, role }: {userId:string;role:'farmer'|'buyer'}) {
  const query=useQuery({queryKey:['review-summary',userId],enabled:!!userId,retry:false,queryFn:async()=>{
    const result=await supabase.rpc('my_review_summary');if(result.error)throw result.error;return result.data as Summary;
  }});
  return <section className="panel review-summary" aria-label="Đánh giá giao dịch"><h2>Đánh giá giao dịch</h2>
    {query.isPending?<p>Đang tải đánh giá…</p>:query.isError?<p role="alert">Không tải được đánh giá. <button className="text-link" onClick={()=>void query.refetch()}>Thử lại</button></p>:<>
      <strong className="review-score">{query.data.count?`${Number(query.data.average).toFixed(1)}/5`:'Chưa có đánh giá'}</strong><p>{query.data.count} lượt đánh giá nhận được</p>
      <RatingStars value={Number(query.data.average ?? 0)} />
    </>}<Link to={`/${role}/reviews`}>Xem tất cả đánh giá →</Link>
  </section>;
}
