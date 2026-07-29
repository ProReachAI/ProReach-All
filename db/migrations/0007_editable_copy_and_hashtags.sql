alter table posts add column if not exists hashtags text[] not null default '{}';

update posts p
   set hashtags = array[
     '#' || regexp_replace(initcap(pr.name), '[^[:alnum:]_]', '', 'g'),
     case p.pillar
       when 'makeover' then '#BeforeAndAfter'
       when 'insight' then '#ProductInsights'
       when 'building' then '#BuildingInPublic'
       else '#ProductUpdate'
     end
   ]
  from campaigns c
  join projects pr on pr.id = c.project_id
 where p.campaign_id = c.id
   and cardinality(p.hashtags) = 0;
