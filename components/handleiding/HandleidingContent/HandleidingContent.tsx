'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './HandleidingContent.module.scss';

interface Props {
  role: 'developer' | 'owner' | 'employee' | 'technician';
  siteParam: string;
  fromLogin: boolean;
}

interface Section {
  id: string;
  icon: string;
  title: string;
  badge?: string;
  badgeVariant?: 'blue' | 'green';
  roles: ('developer' | 'owner' | 'employee' | 'technician')[];
  content: React.ReactNode;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[styles.chevron, open ? styles.chevronOpen : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ButtonItem({ tag, desc }: { tag: string; desc: string }) {
  return (
    <div className={styles.buttonItem}>
      <span className={styles.buttonTag}>{tag}</span>
      <span className={styles.buttonDesc}>{desc}</span>
    </div>
  );
}

export function HandleidingContent({ role, siteParam, fromLogin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<Record<string, boolean>>({ dashboard: true });
  const [navigating, setNavigating] = useState(false);

  async function handleContinue() {
    setNavigating(true);
    await fetch('/api/handleiding', { method: 'POST' });
    const dest = siteParam ? `/?site=${siteParam}` : '/';
    router.push(dest);
    router.refresh();
  }

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const sections: Section[] = [
    {
      id: 'dashboard',
      icon: '📊',
      title: 'Dashboard',
      badge: '/',
      roles: ['developer', 'owner', 'employee'],
      content: (
        <>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Wat is dit?</span>
            <p className={styles.text}>
              Het dashboard is de startpagina van de app. Hier zie je in één oogopslag hoe de carwash
              presteert: het totale aantal wassen, verbruikskosten, lopende alerts en onderhoudstaken
              die aandacht vereisen.
            </p>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Knoppen &amp; acties</span>
            <div className={styles.buttonList}>
              <ButtonItem tag="Site selector" desc="Bovenaan kun je wisselen tussen de carwashlocaties waartoe je toegang hebt." />
              <ButtonItem tag="Periode (week / maand)" desc="Schakel tussen een weekoverzicht en een maandoverzicht van de statistieken." />
              <ButtonItem tag="Prijs / Eenheid" desc="Bekijk kosten in euro of in verbruikseenheden (liters, kg, kWh)." />
              <ButtonItem tag="Account-icoon" desc="Rechtsboven navigeer je naar je accountinstellingen." />
              <ButtonItem tag="Alert-kaarten" desc="Rode of oranje kaarten wijzen op lage voorraad of achterstallig onderhoud. Klik erop voor meer details." />
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'dagfiche',
      icon: '📋',
      title: 'Dagfiche',
      badge: '/dagfiche',
      roles: ['developer', 'owner', 'employee'],
      content: (
        <>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Wat is dit?</span>
            <p className={styles.text}>
              De dagfiche is de dagelijkse checklist die medewerkers invullen. Je registreert het
              aantal wassen per programma, het verbruik van chemicaliën, zout en flockmiddel, en of
              er bijzonderheden zijn.
            </p>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Knoppen &amp; acties</span>
            <div className={styles.buttonList}>
              <ButtonItem tag="Programma-teller" desc="Voer het aantal wagens per wasprogramma in door de teller te verhogen of een getal in te typen." />
              <ButtonItem tag="Verbruik invullen" desc="Vul de hoeveelheden in voor chemicaliën, zout, flockmiddel en ruitendoekjes." />
              <ButtonItem tag="Opmerking" desc="Voeg optioneel een opmerking toe bij bijzonderheden van de dag." />
              <ButtonItem tag="Versturen" desc="Klik op 'Versturen' om de dagfiche op te slaan. Dit kan slechts één keer per dag per site." />
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'wekelijkse-ingave',
      icon: '📅',
      title: 'Wekelijkse ingave',
      badge: 'Eigenaar',
      badgeVariant: 'blue',
      roles: ['developer', 'owner'],
      content: (
        <>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Wat is dit?</span>
            <p className={styles.text}>
              Als eigenaar of beheerder voer je hier wekelijks de wasaantallen en het chemicaliënverbruik
              in. De gegevens worden gebruikt voor kostprijsberekeningen en rapportage in de historiek.
            </p>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Knoppen &amp; acties</span>
            <div className={styles.buttonList}>
              <ButtonItem tag="Week selecteren" desc="Kies de week waarover je gegevens invult via de weekkiezer bovenaan." />
              <ButtonItem tag="Wasaantallen" desc="Vul per programma het totale aantal wassen in voor die week." />
              <ButtonItem tag="Verbruik" desc="Registreer het verbruik van alle chemicaliën, zout, flockmiddel en energie voor die week." />
              <ButtonItem tag="Opslaan" desc="Klik op 'Opslaan' om de weekingave te bewaren. Bestaande ingaves kunnen later worden bewerkt." />
              <ButtonItem tag="Bewerken" desc="Een eerder opgeslagen weekingave kun je aanpassen via het potloodpictogram." />
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'historiek',
      icon: '🕰️',
      title: 'Historiek',
      badge: 'Eigenaar',
      badgeVariant: 'blue',
      roles: ['developer', 'owner'],
      content: (
        <>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Wat is dit?</span>
            <p className={styles.text}>
              De historiek toont een overzicht van alle wekelijkse ingaves, gesorteerd van nieuw naar
              oud. Je kunt per week de kostprijs, het verbruik en de wasaantallen raadplegen.
            </p>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Knoppen &amp; acties</span>
            <div className={styles.buttonList}>
              <ButtonItem tag="Week-rij" desc="Klik op een week om de details in te klappen: wasaantallen, verbruik en berekende kosten." />
              <ButtonItem tag="Weergave (Prijs / Eenheid)" desc="Schakel bovenaan tussen de kostprijsweergave (€) en de eenheidsweergave (L, kg, kWh)." />
              <ButtonItem tag="Periode (week / maand)" desc="Groepeer de weergave per week of per maand." />
              <ButtonItem tag="Bewerken / Verwijderen" desc="Via de icoontjes op elke rij kun je een weekingave aanpassen of verwijderen." />
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'incidenten',
      icon: '🚨',
      title: 'Incidenten',
      badge: '/incidenten',
      roles: ['developer', 'owner', 'employee'],
      content: (
        <>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Wat is dit?</span>
            <p className={styles.text}>
              Hier registreer en bekijk je incidenten op de carwash. Er zijn twee types: EHBO
              (gezondheids- en veiligheidsincidenten) en Schade (schade aan voertuigen of installaties).
            </p>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Knoppen &amp; acties</span>
            <div className={styles.buttonList}>
              <ButtonItem tag="+ EHBO" desc="Registreer een nieuw EHBO-incident: vul datum, omschrijving en betrokkenen in." />
              <ButtonItem tag="+ Schade" desc="Meld schade aan een voertuig of aan de installatie met foto-upload en beschrijving." />
              <ButtonItem tag="Incident-kaart" desc="Klik op een bestaand incident voor de volledige details en eventueel om het te bewerken of te verwijderen." />
              <ButtonItem tag="Tabs (EHBO / Schade)" desc="Wissel bovenaan tussen de twee incidenttypes." />
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'account',
      icon: '⚙️',
      title: 'Account & instellingen',
      badge: '/account',
      roles: ['developer', 'owner', 'employee'],
      content: (
        <>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Wat is dit?</span>
            <p className={styles.text}>
              Via de accountpagina beheer je jouw profiel, de prijsconfiguratie van de site, het
              personeel, de chemievoorraad en de onderhoudsplanning. Medewerkers zien enkel hun
              eigen profielgegevens.
            </p>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Knoppen &amp; acties</span>
            <div className={styles.buttonList}>
              <ButtonItem tag="E-mail wijzigen" desc="Pas je inlogadres aan onder 'Accountgegevens'." />
              <ButtonItem tag="Wachtwoord wijzigen" desc="Voer een nieuw wachtwoord in en klik op 'Opslaan'." />
              <ButtonItem tag="Kostprijzen (eigenaar)" desc="Stel de prijs per eenheid in voor energie, water, zout, flockmiddel en chemicaliën." />
              <ButtonItem tag="Gebruikers beheren (eigenaar)" desc="Voeg nieuwe medewerkers toe of trek de toegang van bestaande gebruikers in." />
              <ButtonItem tag="Voorraad (eigenaar)" desc="Stel het huidige voorraadniveau en het minimale alertniveau in per product. Registreer leveringen via '+ Levering'." />
              <ButtonItem tag="Onderhoud (eigenaar)" desc="Bekijk en markeer onderhoudstaken als 'Gedaan' met de datum van uitvoering." />
              <ButtonItem tag="Energiefacturen (eigenaar)" desc="Voeg maandelijkse energiefacturen toe voor kostprijsrapportage." />
              <ButtonItem tag="Handleiding" desc="Kom terug naar deze pagina om de uitleg opnieuw te lezen." />
            </div>
          </div>
        </>
      ),
    },
    ...(role === 'developer'
      ? [
          {
            id: 'developer',
            icon: '🛠️',
            title: 'Developer-paneel',
            badge: 'Developer',
            badgeVariant: 'green' as const,
            roles: ['developer'] as ('developer' | 'owner' | 'employee' | 'technician')[],
            content: (
              <>
                <div className={styles.subSection}>
                  <span className={styles.subTitle}>Wat is dit?</span>
                  <p className={styles.text}>
                    Het developer-paneel geeft toegang tot beheerfuncties: sites aanmaken en bewerken,
                    wasprogramma&apos;s configureren, onderhoudstaken instellen en de database-seedtools.
                    Alleen zichtbaar voor accounts met de developer-rol.
                  </p>
                </div>
                <div className={styles.subSection}>
                  <span className={styles.subTitle}>Knoppen &amp; acties</span>
                  <div className={styles.buttonList}>
                    <ButtonItem tag="Sites beheren" desc="Maak nieuwe carwashlocaties aan, bewerk de naam en locatie of verwijder een site." />
                    <ButtonItem tag="Wasprogramma's" desc="Definieer de wasprogramma's per site: naam, tier, gebruikte chemicaliën en doekjes." />
                    <ButtonItem tag="Onderhoudstaken" desc="Voeg onderhoudstaken toe met een triggertype (wassen, maanden of vaste datum)." />
                    <ButtonItem tag="Seed / Cleanup" desc="Vul de database met testdata of verwijder alle collecties voor een schone start." />
                  </div>
                </div>
              </>
            ),
          },
        ]
      : []),
    {
      id: 'navigatie',
      icon: '🧭',
      title: 'Navigatie & algemene tips',
      roles: ['developer', 'owner', 'employee'],
      content: (
        <>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Navigeren tussen pagina&apos;s</span>
            <div className={styles.buttonList}>
              <ButtonItem tag="← Pijl (terug)" desc="De pijl linksboven brengt je terug naar de vorige pagina of het dashboard." />
              <ButtonItem tag="Site selector" desc="Via de pillknop bovenaan wissel je van carwashlocatie zonder opnieuw in te loggen." />
              <ButtonItem tag="Account-icoon" desc="Het persoonsicoontje rechtsboven opent de accountpagina." />
            </div>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Installeren als app</span>
            <p className={styles.text}>
              WashIQ werkt als een Progressive Web App (PWA). Op Android verschijnt er een
              installatieknop op de inlogpagina. Op iOS (Safari): tik op het deelknopje en kies
              &ldquo;Zet op beginscherm&rdquo;. Eenmaal geïnstalleerd opent de app in volledig scherm
              zonder browserbalk.
            </p>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>Push-meldingen</span>
            <p className={styles.text}>
              De app kan meldingen sturen bij lage voorraad en achterstallig onderhoud. Keur
              meldingen goed via de pop-up die verschijnt na het inloggen om dit te activeren.
            </p>
          </div>
        </>
      ),
    },
  ];

  const visibleSections = sections.filter((s) => s.roles.includes(role));

  return (
    <div className={styles.wrap}>
      <div className={styles.introBanner}>
        <h1 className={styles.introTitle}>Welkom bij WashIQ</h1>
        <p className={styles.introSubtitle}>
          Deze handleiding legt uit hoe de app werkt en wat alle knoppen betekenen.
          Klik op een onderdeel om de uitleg te tonen. Je kunt deze pagina altijd
          opnieuw raadplegen via je accountpagina.
        </p>
      </div>

      {visibleSections.map((section) => (
        <div key={section.id} className={styles.card}>
          <div
            className={styles.cardHeader}
            onClick={() => toggle(section.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && toggle(section.id)}
            aria-expanded={!!open[section.id]}
          >
            <span className={styles.cardIcon} aria-hidden="true">{section.icon}</span>
            <span className={styles.cardTitle}>{section.title}</span>
            {section.badge && (
              <span className={[styles.cardBadge, section.badgeVariant === 'green' ? styles.cardBadgeGreen : ''].filter(Boolean).join(' ')}>
                {section.badge}
              </span>
            )}
            <ChevronIcon open={!!open[section.id]} />
          </div>
          {open[section.id] && (
            <div className={styles.cardBody}>
              {section.content}
            </div>
          )}
        </div>
      ))}

      <div className={styles.footerActions}>
        {fromLogin ? (
          <button
            className={styles.continueBtn}
            onClick={handleContinue}
            disabled={navigating}
          >
            {navigating ? 'Bezig...' : 'Begrepen, ga verder →'}
          </button>
        ) : (
          <Link
            href={siteParam ? `/?site=${siteParam}` : '/'}
            className={styles.backBtn}
          >
            ← Terug naar dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
