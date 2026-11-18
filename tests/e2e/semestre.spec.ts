import { test,expect,type BrowserContext,type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
const inst='11111111-1111-4111-8111-111111111111';
const ids={admin:'33333333-3333-4333-8333-333333333333',prof:'44444444-4444-4444-8444-444444444444',
 alumno:'66666666-6666-4666-8666-666666666666',director:'77777777-7777-4777-8777-777777777777'};
async function ingresar(context:BrowserContext,rol:keyof typeof ids){
 const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({usuarioId:ids[rol],sub:ids[rol],email:rol+'@example.invalid',nombre:'Demo',
 institucionActivaId:inst,roles:[],aud:'dualcampus:sesion',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 const token=head+'.'+body+'.'+createHmac('sha256','secreto-exclusivo-e2e-no-utilizar-en-produccion').update(head+'.'+body).digest('base64url');
 await context.clearCookies();
 await context.addCookies([{name:'dc_sesion',value:token,url:'http://localhost:5173',httpOnly:true,sameSite:'Lax'}]);
}
async function irAlModulo(page:Page,nombre:string){
 const nav=page.getByRole('navigation',{name:'Secciones disponibles'});
 await expect(nav).toBeVisible();
 const boton=nav.getByRole('button',{name:nombre,exact:true});
 await expect(boton).toBeVisible();
 await boton.click();
}
test('configuración persistente, validación y permisos de cuatro roles',async({page,context},testInfo)=>{
 test.setTimeout(120_000);
 const errores:string[]=[];page.on('pageerror',e=>errores.push(e.message));
 await ingresar(context,'admin');await page.goto('/');
 await expect(page.getByRole('heading',{name:'Períodos académicos'})).toBeVisible();
 await page.getByLabel('Nombre',{exact:true}).first().fill('2026 · Semestre demo');
 await page.getByLabel('Inicio',{exact:true}).fill('2026-08-01');
 await page.getByLabel('Término',{exact:true}).fill('2026-12-20');
 await page.getByRole('button',{name:'Crear período',exact:true}).click();
 await expect(page.getByText(/Del 2026-08-01 al 2026-12-20/)).toBeVisible();
 await irAlModulo(page,'Cursos y secciones');
 await expect(page.getByLabel('Código del curso')).toBeVisible();
 await page.getByLabel('Código del curso').fill('ICC-4204');
 await page.getByLabel('Nombre',{exact:true}).fill('Introducción al software');
 // Facultad es opcional: dejarla vacía debe usar el valor predeterminado de la API.
 const creacionCurso=page.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/api/academico/cursos');
 await page.getByRole('button',{name:'Crear curso',exact:true}).click();
 const respuestaCurso=await creacionCurso;
 expect(respuestaCurso.status(),await respuestaCurso.text()).toBe(201);
 expect(await respuestaCurso.json()).toMatchObject({codigo:'ICC-4204',facultad:'General'});
 await expect(page.getByText('Curso creado. Ahora puedes registrar su sección.',{exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Curso',exact:true}).selectOption({label:'ICC-4204 · Introducción al software'});
 await page.getByLabel('Código de sección').fill('01');
 await page.getByRole('button',{name:'Crear sección',exact:true}).click();
 await irAlModulo(page,'Equipo y nómina');
 await page.getByRole('combobox',{name:'Sección de trabajo'}).selectOption({label:'ICC-4204 · Introducción al software · Sección 01'});
 await page.getByRole('combobox',{name:'Profesor',exact:true}).selectOption({label:'Profesora Demo'});
 await page.getByLabel('Ayudante Demo',{exact:true}).check();
 await page.getByRole('button',{name:'Guardar equipo'}).click();
 await expect(page.getByText('Equipo docente guardado.',{exact:true})).toBeVisible();
 await page.getByLabel('Correos de alumnos').fill('alumno@example.invalid\nno-es-correo');
 await page.getByRole('button',{name:'Validar nómina'}).click();
 await expect(page.getByRole('cell',{name:'Correo inválido',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Confirmar carga'})).toBeDisabled();
 await page.getByLabel('Correos de alumnos').fill('alumno@example.invalid');
 await page.getByRole('button',{name:'Validar nómina'}).click();
 await page.getByRole('button',{name:'Confirmar carga'}).click();
 await expect(page.getByText('Nómina guardada: 1 alumnos nuevos; 1 en total.',{exact:true})).toBeVisible();
 await page.reload();
 await irAlModulo(page,'Equipo y nómina');
 await expect(page.getByRole('cell',{name:'Estudiante Demo',exact:true})).toBeVisible();
 await irAlModulo(page,'Períodos académicos');
 await page.getByLabel('Nombre',{exact:true}).first().fill('2027 · Otro período');
 await page.getByLabel('Inicio',{exact:true}).fill('2027-03-01');
 await page.getByLabel('Término',{exact:true}).fill('2027-07-01');
 await page.getByRole('button',{name:'Crear período',exact:true}).click();
 await expect(page.getByText(/Del 2027-03-01 al 2027-07-01/)).toBeVisible();
 await irAlModulo(page,'Equipo y nómina');
 await expect(page.getByRole('combobox',{name:'Sección de trabajo'})).toHaveCount(0);
 await page.getByRole('combobox',{name:'Período de trabajo',exact:true}).selectOption({label:'2026 · Semestre demo'});
 await expect(page.getByText(/Del 2026-08-01 al 2026-12-20/)).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Sección de trabajo'})).toContainText('ICC-4204');
 await page.screenshot({path:testInfo.outputPath('01-configuracion.png'),fullPage:true});
 await page.getByLabel('Institución activa').selectOption({label:'Instituto de Ciencias de la Salud'});
 await expect(page.getByText('Sin períodos registrados.',{exact:true})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Sección de trabajo'})).toHaveCount(0);
 await ingresar(context,'prof');await page.reload();
 await irAlModulo(page,'Mis secciones');
 await page.getByRole('combobox',{name:'Período de trabajo',exact:true}).selectOption({label:'2026 · Semestre demo'});
 await expect(page.getByRole('button',{name:/ICC-4204 · Sección 01/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Crear curso',exact:true})).toHaveCount(0);
 await page.screenshot({path:testInfo.outputPath('02-docente.png'),fullPage:true});
 await ingresar(context,'alumno');await page.reload();
 await irAlModulo(page,'Mis secciones');
 await page.getByRole('combobox',{name:'Período de trabajo',exact:true}).selectOption({label:'2026 · Semestre demo'});
 await expect(page.getByRole('button',{name:/ICC-4204 · Sección 01/})).toBeVisible();
 await expect(page.getByRole('cell',{name:'alumno@example.invalid',exact:true})).toHaveCount(0);
 await irAlModulo(page,'Mis calificaciones');
 await expect(page.getByRole('heading',{name:'Mis calificaciones'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:testInfo.outputPath('03-alumno-movil.png'),fullPage:true});
 await ingresar(context,'director');await page.reload();
 await expect(page.getByRole('heading',{name:'Consulta institucional'})).toBeVisible();
 await expect(page.getByRole('button',{name:/ICC-4204 · Sección 01/})).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('alumno@example.invalid');
 await page.getByRole('button',{name:'Cerrar sesión'}).click();
 await expect(page.getByRole('link',{name:/Google/})).toBeVisible();
 expect(errores).toEqual([]);
});

for (const caso of [
 {nombre:'solo espacios',entrada:'   ',esperada:'General'},
 {nombre:'facultad indicada',entrada:'  Ingeniería  ',esperada:'Ingeniería'},
]) {
 test('crear curso con facultad: '+caso.nombre,async({page,context})=>{
  await ingresar(context,'admin');await page.goto('/');
  await irAlModulo(page,'Períodos académicos');
  await page.getByLabel('Nombre',{exact:true}).fill('Facultad · '+caso.nombre);
  await page.getByLabel('Inicio',{exact:true}).fill('2026-08-01');
  await page.getByLabel('Término',{exact:true}).fill('2026-12-20');
  await page.getByRole('button',{name:'Crear período',exact:true}).click();
  await expect(page.getByText(/Del 2026-08-01 al 2026-12-20/)).toBeVisible();
  await irAlModulo(page,'Cursos y secciones');
  await page.getByLabel('Código del curso').fill('FAC-01');
  await page.getByLabel('Nombre',{exact:true}).fill('Curso de prueba');
  await page.getByLabel('Facultad',{exact:true}).fill(caso.entrada);
  const creacion=page.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/api/academico/cursos');
  await page.getByRole('button',{name:'Crear curso',exact:true}).click();
  const respuesta=await creacion;
  expect(respuesta.status(),await respuesta.text()).toBe(201);
  const curso=await respuesta.json();
  expect(curso).toMatchObject({codigo:'FAC-01',facultad:caso.esperada});
  await expect(page.getByText('Curso creado. Ahora puedes registrar su sección.',{exact:true})).toBeVisible();
  // Esperar la actualización posterior al POST antes de observar la recarga.
  await expect(page.getByRole('combobox',{name:'Curso',exact:true})).toContainText('FAC-01 · Curso de prueba');
  await page.reload();
  const listado=page.waitForResponse(r=>r.request().method()==='GET' && new URL(r.url()).pathname==='/api/academico/cursos');
  await irAlModulo(page,'Cursos y secciones');
  const consulta=await listado;
  expect(consulta.status()).toBe(200);
  expect(await consulta.json()).toContainEqual(expect.objectContaining({id:curso.id,facultad:caso.esperada}));
 });
}

// H43: el alumno vincula una cuenta personal desde su perfil y la asociación persiste.
// La verificación con Google se reemplaza por la vinculación local (no existe en producción).
test('H43 · vincular una cuenta personal desde el perfil',async({page,context},testInfo)=>{
 await ingresar(context,'prof');await page.goto('/');
 await expect(page.getByRole('navigation',{name:'Secciones disponibles'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Mi perfil',exact:true})).toHaveCount(0);
 await ingresar(context,'alumno');await page.reload();
 await irAlModulo(page,'Mi perfil');
 await expect(page.getByText('Todavía no tienes una cuenta personal vinculada.',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Vincular cuenta personal',exact:true})).toHaveAttribute('href','/api/cuenta-personal/vincular');
 await page.getByRole('link',{name:/cuenta personal de prueba/}).click();
 await expect(page.getByText('Cuenta personal verificada y vinculada.',{exact:true})).toBeVisible();
 await expect(page.getByText('personal.demo@example.invalid',{exact:true})).toBeVisible();
 expect(new URL(page.url()).search).toBe('');
 await page.screenshot({path:testInfo.outputPath('04-alumno-perfil.png'),fullPage:true});
 await page.reload();
 await irAlModulo(page,'Mi perfil');
 await expect(page.getByText('personal.demo@example.invalid',{exact:true})).toBeVisible();
 await expect(page.getByText('Cuenta personal verificada y vinculada.',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Cambiar cuenta personal',exact:true})).toBeVisible();
});

// Cuentas de prueba @testing.com: se crean sin administrador y se ingresa sin Google ni contraseña.
test('crear y probar usuarios desde el login',async({page,context},testInfo)=>{
 await context.clearCookies();
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/');
 await page.getByRole('button',{name:'Crear y probar usuarios',exact:true}).click();
 await expect(page.getByRole('button',{name:'Crear cuenta',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Usuario @testing.com'}).fill('ana.e2e');
 await page.getByLabel('Nombre visible (opcional)').fill('Ana Prueba');
 await page.getByRole('combobox',{name:'Rol',exact:true}).selectOption({label:'Profesor'});
 await page.getByRole('combobox',{name:'Institución',exact:true}).selectOption({label:'Universidad grande'});
 await page.getByRole('button',{name:'Crear cuenta de prueba',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('ana.e2e@testing.com creada como Profesor en Universidad grande');
 await page.screenshot({path:testInfo.outputPath('05-crear-cuenta-prueba.png'),fullPage:true});
 await page.getByRole('button',{name:'Ingresar con esta cuenta',exact:true}).click();
 await expect(page.locator('.barra-usuario')).toContainText('Ana Prueba');
 await page.getByRole('button',{name:'Cerrar sesión'}).click();

 // Una cuenta que ya existe no se vuelve a crear.
 await page.getByRole('button',{name:'Crear y probar usuarios',exact:true}).click();
 await page.getByRole('textbox',{name:'Usuario @testing.com'}).fill('ana.e2e');
 await page.getByRole('button',{name:'Crear cuenta de prueba',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Ya existe una cuenta ana.e2e@testing.com');

 // Superadministrador: no pide institución.
 await page.getByRole('combobox',{name:'Rol',exact:true}).selectOption({label:'Superadministrador'});
 await expect(page.getByRole('combobox',{name:'Institución',exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Usuario @testing.com'}).fill('super.e2e');
 await page.getByRole('button',{name:'Crear cuenta de prueba',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('super.e2e@testing.com creada como Superadministrador.');

 // Iniciar sesión escribiendo el correo, sin contraseña.
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await page.getByLabel('Correo de la cuenta de prueba').fill('no.existe@testing.com');
 await page.getByRole('button',{name:'Ingresar',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('No hay una cuenta de prueba habilitada');
 await page.getByLabel('Correo de la cuenta de prueba').fill('super.e2e');
 await page.screenshot({path:testInfo.outputPath('06-ingresar-cuenta-prueba.png'),fullPage:true});
 await page.getByRole('button',{name:'Ingresar',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Secciones disponibles'}).getByRole('button',{name:'Universidades',exact:true})).toBeVisible();
});

// Nota corregida: el alumno ve la nota anterior tachada junto a la nueva.
test('nota corregida muestra la anterior y la nueva',async({page,context,request},testInfo)=>{
 const token=async(rol:keyof typeof ids)=>{await ingresar(context,rol);return (await context.cookies()).find(c=>c.name==='dc_sesion')!.value;};
 const api=async(rol:keyof typeof ids,metodo:'post'|'put'|'get',ruta:string,datos?:unknown)=>{
   const res=await request[metodo]('/api/'+ruta,{headers:{Cookie:'dc_sesion='+await token(rol)},...(datos===undefined?{}:{data:datos})});
   expect(res.ok(),ruta+' → '+res.status()+' '+await res.text()).toBe(true);
   return res.json();
 };
 const periodo=(await api('admin','post','periodos',{nombre:'2027 · Corrección',fechaInicio:'2027-08-01',fechaFin:'2027-12-20'})).id;
 const curso=(await api('admin','post','academico/cursos',{periodoId:periodo,codigo:'NOT-101',nombre:'Notas corregidas'})).id;
 const seccion=(await api('admin','post','academico/secciones',{periodoId:periodo,cursoId:curso,codigo:'01'})).id;
 await api('admin','put',`academico/secciones/${seccion}/equipo`,{profesorId:ids.prof,ayudanteIds:[]});
 await api('admin','post',`academico/secciones/${seccion}/nomina`,{emails:['alumno@example.invalid']});
 const evaluacion=(await api('prof','post',`calificaciones/secciones/${seccion}/evaluaciones`,{nombre:'Control corregido',fecha:'2027-09-01',ponderacion:30})).id;
 await api('prof','put',`calificaciones/evaluaciones/${evaluacion}/notas`,{notas:[{alumnoId:ids.alumno,valor:4.5}]});
 await api('prof','post',`calificaciones/evaluaciones/${evaluacion}/enviar-revision`,{});
 await api('prof','post',`calificaciones/evaluaciones/${evaluacion}/publicar`,{});
 const fila=(await api('admin','get',`calificaciones/evaluaciones/${evaluacion}/notas`)).filas[0];
 await api('admin','post',`calificaciones/evaluaciones/${evaluacion}/notas/${ids.alumno}/correcciones`,
   {valor:5.8,motivo:'Error de suma',referencia:'SOL-E2E',valorPrevio:fila.valor,ausentePrevio:fila.esAusente,actualizadoEn:fila.actualizadoEn});

 await ingresar(context,'alumno');await page.goto('/');
 await irAlModulo(page,'Mis secciones');
 await page.getByRole('combobox',{name:'Período de trabajo',exact:true}).selectOption({label:'2027 · Corrección'});
 await page.getByRole('button',{name:/NOT-101 · Sección 01/}).click();
 await irAlModulo(page,'Mis calificaciones');
 const celda=page.getByLabel('Nota corregida: antes 4.5, ahora 5.8');
 await expect(celda).toBeVisible();
 await expect(page.locator('.nota-anterior')).toHaveText('4.5');
 await expect(page.getByText(/^Corregida el /)).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('08-nota-corregida.png'),fullPage:true});
});
