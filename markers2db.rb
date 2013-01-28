require 'rubygems'
require 'mongo'

include Mongo

@client = MongoClient.new('localhost', 27017)
@db     = @client['suzuri']
@coll   = @db['markers']

@coll.remove

marker_id = 0
File::open('AR_markers.txt'){|f|
  while line = f.gets
    @coll.insert({'marker_id' => marker_id, 'marker' => line.chomp, 'occupied' => false})
    marker_id += 1
  end
}

puts "#{@coll.count} records added."
