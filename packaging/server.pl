#!/usr/bin/perl
# Tiny private web server for Guitar Coach. Only reachable from this Mac (127.0.0.1).
# Chrome remembers microphone permission for http://localhost, but not for files opened from disk.
# Usage: perl server.pl PORT /path/to/app.html guitarcoach-server
use strict;
use warnings;
use IO::Socket::INET;

my ($port, $file) = @ARGV;
my $srv = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => $port, Listen => 20, ReuseAddr => 1, Timeout => 600)
  or die "Could not start on port $port\n";
$SIG{CHLD} = 'IGNORE';
my $idle = 0;
while (1) {
  my $c = $srv->accept;
  if (!$c) { $idle += 600; exit 0 if $idle >= 6 * 3600; next; }   # stop after 6 idle hours
  $idle = 0;
  my $pid = fork();
  if (!defined $pid) { close $c; next; }
  if ($pid) { close $c; next; }
  # child: handle one request
  alarm 15;
  my $req = <$c> // '';
  while (my $l = <$c>) { last if $l =~ /^\r?\n$/; }
  my ($path) = $req =~ m{^GET\s+(\S+)};
  $path //= '';
  if ($path eq '/ping') {
    print $c "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 12\r\nConnection: close\r\n\r\nguitar-coach";
  } elsif ($path =~ m{^/(index\.html)?(\?.*)?$}) {
    if (open(my $fh, '<:raw', $file)) {
      local $/; my $body = <$fh>; close $fh;
      print $c "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nContent-Length: " . length($body) . "\r\nConnection: close\r\n\r\n";
      print $c $body;
    } else {
      print $c "HTTP/1.1 500 Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    }
  } else {
    print $c "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
  }
  close $c;
  exit 0;
}
