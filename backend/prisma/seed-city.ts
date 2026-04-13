/**
 * Seed "Cidade Grande" — gera dados em volume para testar o sistema.
 * Executar: npm run prisma:seed:city
 * Ajuste NUM_ESCOLAS e ALUNOS_POR_ESCOLA abaixo para testes mais rápidos ou mais dados.
 */
import { PrismaClient, UserRole, SituacaoMatricula } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const NOMES = [
  'Ana', 'Bruno', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Julia',
  'Lucas', 'Mariana', 'Nathan', 'Olivia', 'Pedro', 'Quiteria', 'Rafael', 'Sophia', 'Thiago', 'Valentina',
  'Vitor', 'Beatriz', 'Felipe', 'Larissa', 'Matheus', 'Isabela', 'Leonardo', 'Amanda', 'Gustavo', 'Camila',
];
const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
  'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Rocha', 'Almeida', 'Nascimento', 'Araújo', 'Fernandes', 'Soares',
];
const BAIRROS = [
  'Centro', 'Jardim das Flores', 'Vila Nova', 'São José', 'Santa Maria', 'Alto da Colina',
  'Bela Vista', 'Parque Industrial', 'Zona Sul', 'Cidade Alta', 'Morada Verde', 'Praia Grande',
  'Recanto dos Lagos', 'Vila Esperança', 'Boa Esperança', 'Nova Cidade', 'Jardim América',
  'Parque dos Eucaliptos', 'Vila Progresso', 'Alvorada',
];
const SERIES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'];
const DISCIPLINAS = ['Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia', 'Artes', 'Educação Física'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function between(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function cpfFromCounter(n: number): string {
  const s = String(10000000000 + (n % 100000000000)).padStart(11, '0');
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

async function main() {
  console.log('🌆 Iniciando seed Cidade Grande...');

  const hash = await bcrypt.hash('admin123', 10);

  const municipality = await prisma.municipality.upsert({
    where: { id: 'seed-cidade-grande' },
    update: {},
    create: {
      id: 'seed-cidade-grande',
      name: 'Cidade Grande',
      state: 'SP',
    },
  });

  await prisma.user.upsert({
    where: { email: 'superadmin@municipio.gov.br' },
    update: {},
    create: {
      email: 'superadmin@municipio.gov.br',
      passwordHash: hash,
      name: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      schoolId: null,
    },
  });

  // Massa grande: 300–400 alunos/escola. Para teste rápido use ex.: 5 escolas e 30 alunos.
  const NUM_ESCOLAS = 18;
  const ALUNOS_POR_ESCOLA = 350;
  const ANOS_LETIVOS = [2022, 2023, 2024];

  const schools: { id: string; name: string; code: string }[] = [];
  for (let i = 1; i <= NUM_ESCOLAS; i++) {
    const code = `35${String(600000 + i).padStart(6, '0')}`;
    const name = i === 1 ? 'EMEF Centro' : `EMEF ${pick(BAIRROS)} ${i}`;
    const school = await prisma.school.upsert({
      where: { code },
      update: {},
      create: {
        municipalityId: municipality.id,
        name,
        code,
        address: `Rua das Escolas, ${i * 100}`,
      },
    });
    schools.push({ id: school.id, name: school.name, code: school.code! });
  }
  console.log(`✅ ${schools.length} escolas criadas/atualizadas.`);

  for (const school of schools) {
    for (const serie of SERIES) {
      const exist = await prisma.gradeConfig.count({ where: { schoolId: school.id, series: serie } });
      if (exist > 0) continue;
      await prisma.gradeConfig.createMany({
        data: DISCIPLINAS.map((subject) => ({
          schoolId: school.id,
          series: serie,
          subject,
          workload: 80,
        })),
      });
    }
  }
  console.log('✅ GradeConfig (disciplinas) por série e escola.');

  const schoolIds = schools.map((s) => s.id);
  const deletedGrades = await prisma.grade.deleteMany({
    where: { enrollment: { student: { schoolId: { in: schoolIds } } } },
  });
  await prisma.enrollment.deleteMany({
    where: { student: { schoolId: { in: schoolIds } } },
  });
  const deletedStudents = await prisma.student.deleteMany({
    where: { schoolId: { in: schoolIds } },
  });
  if (deletedStudents.count > 0) {
    console.log(`🗑️ Limpeza (reexecução): ${deletedStudents.count} alunos, matrículas e notas removidos.`);
  }

  let globalStudentIndex = 0;
  let totalStudents = 0;

  for (const school of schools) {
    for (let a = 0; a < ALUNOS_POR_ESCOLA; a++) {
      const cpf = cpfFromCounter(globalStudentIndex);
      globalStudentIndex++;

      const nome = `${pick(NOMES)} ${pick(SOBRENOMES)}`;
      const bairro = pick(BAIRROS);
      const birthYear = between(2012, 2018);
      const birthDate = new Date(birthYear, between(0, 11), between(1, 28));

      const student = await prisma.student.create({
        data: {
          schoolId: school.id,
          name: nome,
          birthDate,
          cpf,
          address: `Rua ${pick(SOBRENOMES)}, ${between(1, 999)} - ${bairro}`,
          neighborhood: bairro,
          contacts: {
            create: [
              {
                name: `Responsável de ${nome.split(' ')[0]}`,
                phone: `19${between(90000, 99999)}${between(1000, 9999)}`,
                isPrimary: true,
              },
            ],
          },
        },
      });

      const numMatriculas = between(1, 3);
      const anosUsados = [...ANOS_LETIVOS].sort(() => Math.random() - 0.5).slice(0, numMatriculas);
      for (const year of anosUsados) {
        const situacoes: SituacaoMatricula[] = ['CURSANDO', 'CONCLUIDO', 'EVADIDO', 'TRANSFERIDO'];
        const pesos = [45, 35, 12, 8];
        let r = Math.random() * 100;
        let situation: SituacaoMatricula = 'CURSANDO';
        for (let i = 0; i < pesos.length; i++) {
          r -= pesos[i];
          if (r <= 0) {
            situation = situacoes[i];
            break;
          }
        }
        if (year === 2024 && situation === 'CONCLUIDO') situation = 'CURSANDO';

        const seriesIndex = between(0, SERIES.length - 1);
        const enrollment = await prisma.enrollment.create({
          data: {
            studentId: student.id,
            schoolId: school.id,
            year,
            series: SERIES[seriesIndex],
            situation,
          },
        });

        const configs = await prisma.gradeConfig.findMany({
          where: { schoolId: school.id, series: SERIES[seriesIndex] },
        });
        for (const config of configs) {
          for (let bim = 1; bim <= 4; bim++) {
            const score = between(40, 100) / 10;
            const frequency = between(30, 40);
            await prisma.grade.create({
              data: {
                enrollmentId: enrollment.id,
                gradeConfigId: config.id,
                bimester: bim,
                score,
                frequency,
              },
            });
          }
        }
      }
      totalStudents++;
    }
    console.log(`  Escola ${school.name}: ${ALUNOS_POR_ESCOLA} alunos.`);
  }

  console.log(`✅ Total de ${totalStudents} alunos com matrículas e notas.`);

  const adminSchool = schools[0];
  await prisma.user.upsert({
    where: { email: 'admin@escola.municipio.gov.br' },
    update: { schoolId: adminSchool.id },
    create: {
      email: 'admin@escola.municipio.gov.br',
      passwordHash: hash,
      name: 'Admin Escolar',
      role: UserRole.ADMIN_ESCOLAR,
      schoolId: adminSchool.id,
    },
  });

  for (let i = 1; i <= 3; i++) {
    await prisma.user.upsert({
      where: { email: `professor${i}@escola.municipio.gov.br` },
      update: {},
      create: {
        email: `professor${i}@escola.municipio.gov.br`,
        passwordHash: hash,
        name: `Professor ${i}`,
        role: UserRole.PROFESSOR,
        schoolId: schools[i - 1].id,
      },
    });
  }
  console.log('✅ Usuários (admin e professores) criados/atualizados.');

  console.log('\n🎉 Seed Cidade Grande concluído.');
  console.log(`   Município: ${municipality.name}/${municipality.state}`);
  console.log(`   Escolas: ${NUM_ESCOLAS} | Alunos: ~${totalStudents}`);
  console.log('   Login: superadmin@municipio.gov.br ou admin@escola.municipio.gov.br / senha: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
