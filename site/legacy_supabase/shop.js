async function addProductToCart(button){
  const user = await requireUser();
  if(!user) return;
  const item={
    user_id:user.id,
    product_key:button.dataset.productKey,
    name:button.dataset.productName,
    image:button.dataset.productImage,
    product_type:button.dataset.productType,
    price:Number(button.dataset.productPrice),
    quantity:1,
    updated_at:new Date().toISOString()
  };
  const {data:old,error:findError}=await supabaseClient.from('cart_items').select('quantity').eq('user_id',user.id).eq('product_key',item.product_key).maybeSingle();
  if(findError){alert(findError.message);return;}
  if(old) item.quantity=old.quantity+1;
  const {error}=await supabaseClient.from('cart_items').upsert(item,{onConflict:'user_id,product_key'});
  if(error){alert(error.message);return;}
  button.textContent='Добавлено ✓';
  setTimeout(()=>button.textContent='В корзину',1200);
  updateCartCounts();
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.btn-add-to-cart').forEach(b=>b.addEventListener('click',()=>addProductToCart(b)));
  updateCartCounts();
});

async function updateCartCounts(){
  const user=await getCurrentUser();
  if(!user){document.querySelectorAll('.cart-count').forEach(x=>x.textContent='0');return;}
  const {data}=await supabaseClient.from('cart_items').select('quantity').eq('user_id',user.id);
  const count=(data||[]).reduce((s,i)=>s+i.quantity,0);
  document.querySelectorAll('.cart-count').forEach(x=>x.textContent=count);
}
async function loadPerfumes() {
    try {
        const response = await fetch('/api/perfumes');

        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }

        const perfumes = await response.json();

        console.log(perfumes);

    } catch (error) {
        console.error(error);
    }
}

loadPerfumes();