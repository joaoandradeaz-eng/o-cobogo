// Transforma uma URL de imagem do Cloudinary numa versão pronta pra preview de
// social (1200x630, recorte inteligente, comprimida e em JPEG). Resolve duas
// dores do WhatsApp: tamanho/aspecto certo p/ o preview grande, e peso baixo
// (o WhatsApp ignora a imagem se passar de ~600KB).
//
// Se a URL não for do Cloudinary, devolve como está (não há o que transformar).
const OG_TRANSFORM = 'c_fill,g_auto,w_1200,h_630,q_auto:good,f_jpg';

export function cloudinaryOgUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  // .../res.cloudinary.com/<cloud>/image/upload/<resto>
  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (!url.includes('res.cloudinary.com') || i === -1) return url;
  const head = url.slice(0, i + marker.length);
  const tail = url.slice(i + marker.length);
  return `${head}${OG_TRANSFORM}/${tail}`;
}
