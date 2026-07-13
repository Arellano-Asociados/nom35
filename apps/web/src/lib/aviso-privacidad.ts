import { createHash } from 'node:crypto';
import { clienteAdmin } from './supabase-admin';

/**
 * Aviso de privacidad (LFPDPPP) — corrección de la auditoría v0.
 *
 * ANTES: tres frases genéricas hardcodeadas en un componente React, sobre las que se
 * recababa el CONSENTIMIENTO EXPRESO para datos sensibles de salud (art. 9). Un
 * consentimiento otorgado sobre un aviso que no reúne los requisitos legales es
 * impugnable — y con él se caía el pilar probatorio del producto. Además el texto no se
 * archivaba: se podía probar QUE aceptaron "v1", no QUÉ decía "v1".
 *
 * AHORA: el texto íntegro de cada versión se archiva en `privacy_notices` (append-only,
 * con sha256) y `consents` apunta a la fila exacta que el titular aceptó.
 *
 * IMPORTANTE — LÍMITE DE ESTE TRABAJO: el texto de abajo es una PLANTILLA BASE redactada
 * conforme a los arts. 8, 15, 16 y 17 de la LFPDPPP, pero:
 *   1. La responsable del tratamiento es LA EMPRESA CLIENTE, no la plataforma. Cada
 *      empresa debe revisar, completar (domicilio, datos del responsable) y publicar su
 *      propio aviso; los campos entre {{llaves}} se sustituyen con sus datos.
 *   2. Debe ser revisada por un abogado antes de usarse con trabajadores reales.
 * La plataforma actúa como ENCARGADA (art. 3 fracc. IX): eso exige además un contrato
 * de encargo (DPA) con cada empresa cliente, que no es parte del código.
 */

export const VERSION_AVISO_BASE = '2026-07-1';

/** Plantilla base. Los campos {{...}} los completa la empresa responsable. */
export function textoAvisoBase(razonSocial: string): string {
  return `AVISO DE PRIVACIDAD INTEGRAL

Responsable del tratamiento
${razonSocial} (en adelante, "la Empresa"), con domicilio en {{DOMICILIO DE LA EMPRESA}}, es responsable del tratamiento de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), su Reglamento y los Lineamientos del Aviso de Privacidad.

Datos personales que se recaban
Para esta evaluación se tratan:
• Datos de identificación y laborales: nombre, correo electrónico, área y centro de trabajo, si atiendes clientes y si supervisas personal.
• DATOS PERSONALES SENSIBLES: tus respuestas a los cuestionarios de la NOM-035-STPS-2018 y los resultados que de ellas se derivan, relativos a factores de riesgo psicosocial y, en su caso, a acontecimientos traumáticos severos. Son datos de salud y, por ello, sensibles en términos del artículo 3, fracción VI de la LFPDPPP.
• Datos de la evidencia de tu consentimiento: fecha, hora y dirección IP desde la que lo otorgaste. La IP se recaba únicamente para acreditar, ante una autoridad, que el consentimiento fue otorgado; no se usa para ningún otro fin.

Finalidades primarias (necesarias)
1. Cumplir con las obligaciones de la NOM-035-STPS-2018: identificar y analizar los factores de riesgo psicosocial, determinar niveles de riesgo y adoptar las medidas de prevención y control que la norma exige.
2. Canalizar a atención clínica a quien lo requiera conforme a la Guía de Referencia I.
3. Conservar la evidencia documental que la norma obliga a exhibir ante la Secretaría del Trabajo y Previsión Social (STPS).

No existen finalidades secundarias: tus datos no se usan para publicidad, mercadotecnia, prospección comercial ni para ninguna decisión sobre tu permanencia, promoción o remuneración.

Quién puede ver qué
• Nadie del lado de la Empresa puede ver tus respuestas individuales, pregunta por pregunta. Nunca. Sin excepciones.
• Los resultados que la Empresa consulta son agregados y anónimos: se ocultan los grupos con menos de tres personas para impedir que se te identifique.
• Únicamente el Responsable Designado —una persona nombrada por la Empresa para este fin— puede consultar un resultado individual procesado, y cada consulta queda registrada en una bitácora inalterable.

Transferencias
Tus datos se almacenan y procesan en la infraestructura de nuestros proveedores tecnológicos (servicios de nube), que actúan como encargados y no pueden usarlos para fines propios. Esos servicios pueden operar servidores fuera de los Estados Unidos Mexicanos. No se realizan otras transferencias a terceros, salvo las que sean legalmente exigibles por una autoridad competente.

Derechos ARCO y revocación del consentimiento
Tienes derecho a Acceder a tus datos, Rectificarlos si son inexactos, Cancelarlos cuando consideres que no se requieren, y Oponerte a su tratamiento; así como a revocar el consentimiento que otorgas con este aviso. Puedes ejercer estos derechos, sin costo, presentando tu solicitud en la plataforma (sección "Derechos ARCO") o escribiendo a {{CORREO DEL RESPONSABLE DE DATOS PERSONALES}}. La Empresa responderá en un plazo máximo de 20 días hábiles.

Ten presente que la Empresa puede negar la cancelación cuando exista una obligación legal de conservar la información: la NOM-035 obliga a conservar los registros de la evaluación como evidencia. En ese caso, se te informará el fundamento y, cumplido el plazo de conservación, tus datos serán bloqueados y posteriormente suprimidos o disociados de tu identidad.

Negativa
Puedes negarte a responder. Si lo haces, no se te aplicará sanción alguna: simplemente no se registrará tu participación en esta evaluación.

Cambios a este aviso
Cualquier cambio se publicará como una versión nueva de este aviso, y se te pedirá tu consentimiento nuevamente antes de recabar más datos. La versión que aceptaste se conserva íntegra y queda asociada a tu consentimiento.

Versión ${VERSION_AVISO_BASE}`;
}

export function sha256Texto(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

export interface AvisoVigente {
  id: string;
  version: string;
  texto: string;
}

/**
 * Aviso vigente de la empresa. Si aún no publicó ninguno, se archiva la plantilla base
 * (append-only) y se devuelve: así el consentimiento SIEMPRE apunta a un texto archivado
 * y verificable, nunca a un componente que puede cambiar con el próximo despliegue.
 */
export async function avisoVigenteDe(
  companyId: string,
  razonSocial: string,
): Promise<AvisoVigente> {
  const supabase = clienteAdmin();

  const { data: existente } = await supabase
    .from('privacy_notices')
    .select('id, version, texto')
    .eq('company_id', companyId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existente) return existente as AvisoVigente;

  const texto = textoAvisoBase(razonSocial);
  const { data: creado, error } = await supabase
    .from('privacy_notices')
    .insert({
      company_id: companyId,
      version: VERSION_AVISO_BASE,
      texto,
      sha256: sha256Texto(texto),
    })
    .select('id, version, texto')
    .single();

  if (creado) return creado as AvisoVigente;

  // Dos trabajadores de la misma empresa pueden abrir el consentimiento a la vez: ambos
  // ven que no hay aviso y ambos intentan archivarlo. El primero gana y el segundo choca
  // con la restricción única (23505) — no es un error, es la carrera esperada: se relee.
  const esDuplicado = (error as { code?: string } | null)?.code === '23505';
  if (esDuplicado) {
    const { data: existenteTrasCarrera } = await supabase
      .from('privacy_notices')
      .select('id, version, texto')
      .eq('company_id', companyId)
      .eq('version', VERSION_AVISO_BASE)
      .single();
    if (existenteTrasCarrera) return existenteTrasCarrera as AvisoVigente;
  }

  throw new Error(`No se pudo archivar el aviso de privacidad: ${error?.message}`);
}
