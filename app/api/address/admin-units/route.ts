import {NextRequest,NextResponse} from 'next/server'

export const dynamic='force-dynamic'
const ROOT='https://raw.githubusercontent.com/onurusluca/turkey-geo-api/main/data/jsonl'
const PROVINCE_FALLBACK=[
[1,'ADANA'],[2,'ADIYAMAN'],[3,'AFYONKARAHİSAR'],[4,'AĞRI'],[68,'AKSARAY'],[5,'AMASYA'],[6,'ANKARA'],[7,'ANTALYA'],[75,'ARDAHAN'],[8,'ARTVİN'],[9,'AYDIN'],[10,'BALIKESİR'],[74,'BARTIN'],[72,'BATMAN'],[69,'BAYBURT'],[11,'BİLECİK'],[12,'BİNGÖL'],[13,'BİTLİS'],[14,'BOLU'],[15,'BURDUR'],[16,'BURSA'],[17,'ÇANAKKALE'],[18,'ÇANKIRI'],[19,'ÇORUM'],[20,'DENİZLİ'],[21,'DİYARBAKIR'],[81,'DÜZCE'],[22,'EDİRNE'],[23,'ELAZIĞ'],[24,'ERZİNCAN'],[25,'ERZURUM'],[26,'ESKİŞEHİR'],[27,'GAZİANTEP'],[28,'GİRESUN'],[29,'GÜMÜŞHANE'],[30,'HAKKARİ'],[31,'HATAY'],[76,'IĞDIR'],[32,'ISPARTA'],[34,'İSTANBUL'],[35,'İZMİR'],[46,'KAHRAMANMARAŞ'],[78,'KARABÜK'],[70,'KARAMAN'],[36,'KARS'],[37,'KASTAMONU'],[38,'KAYSERİ'],[71,'KIRIKKALE'],[39,'KIRKLARELİ'],[40,'KIRŞEHİR'],[79,'KİLİS'],[41,'KOCAELİ'],[42,'KONYA'],[43,'KÜTAHYA'],[44,'MALATYA'],[45,'MANİSA'],[47,'MARDİN'],[33,'MERSİN'],[48,'MUĞLA'],[49,'MUŞ'],[50,'NEVŞEHİR'],[51,'NİĞDE'],[52,'ORDU'],[80,'OSMANİYE'],[53,'RİZE'],[54,'SAKARYA'],[55,'SAMSUN'],[56,'SİİRT'],[57,'SİNOP'],[58,'SİVAS'],[63,'ŞANLIURFA'],[73,'ŞIRNAK'],[59,'TEKİRDAĞ'],[60,'TOKAT'],[61,'TRABZON'],[62,'TUNCELİ'],[64,'UŞAK'],[65,'VAN'],[77,'YALOVA'],[66,'YOZGAT'],[67,'ZONGULDAK']
].map(([id,name])=>({id:Number(id),name:String(name)}))

function parseJsonl(text:string){return text.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>JSON.parse(x))}
async function read(url:string){const r=await fetch(url,{next:{revalidate:60*60*24*14},headers:{'user-agent':'Altus-Sevkiyat/6.0'}});if(!r.ok)throw new Error(`address source ${r.status}`);return parseJsonl(await r.text())}

export async function GET(req:NextRequest){
  const level=req.nextUrl.searchParams.get('level')||'provinces'
  const provinceId=Number(req.nextUrl.searchParams.get('provinceId')||0)
  const districtId=Number(req.nextUrl.searchParams.get('districtId')||0)
  try{
    if(level==='provinces'){
      const rows=await read(`${ROOT}/provinces.jsonl`)
      return NextResponse.json({items:rows.map((x:any)=>({id:x.id,name:x.name,postalCode:x.postal_code,lat:x.coordinates?.latitude??null,lng:x.coordinates?.longitude??null})),source:'NVİ/TÜİK/HGM tabanlı MIT açık veri'})
    }
    if(!provinceId||provinceId<1||provinceId>81)return NextResponse.json({error:'Geçerli il seç.'},{status:400})
    if(level==='districts'){
      const rows=await read(`${ROOT}/province-${provinceId}/districts.jsonl`)
      return NextResponse.json({items:rows.map((x:any)=>({id:x.id,name:x.name,postalCode:x.postal_code})),source:'turkey-geo-api'})
    }
    if(level==='neighborhoods'){
      if(!districtId)return NextResponse.json({error:'İlçe seç.'},{status:400})
      const rows=await read(`${ROOT}/province-${provinceId}/neighborhoods.jsonl`)
      return NextResponse.json({items:rows.filter((x:any)=>Number(x.district_id)===districtId).map((x:any)=>({id:x.id,name:x.name,officialName:x.full_official_name})) ,source:'turkey-geo-api'})
    }
    return NextResponse.json({error:'Bilinmeyen seviye.'},{status:400})
  }catch(error){
    if(level==='provinces')return NextResponse.json({items:PROVINCE_FALLBACK,source:'yerleşik 81 il listesi',degraded:true})
    return NextResponse.json({error:error instanceof Error?error.message:'Adres verisi alınamadı.',degraded:true},{status:503})
  }
}
